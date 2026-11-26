using DomainLayer.Models.BillingModule;
using DomainLayer.Models.BillingModule.Enums;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.PlatformModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Presistence.Data;
using Service.Services;

namespace ReviveHRSystem.Web.BackgroundJobs
{
    /// <summary>
    /// Options for the platform billing jobs.
    ///
    /// <see cref="Enabled"/> defaults to <c>false</c>: a worker that issues real invoices,
    /// flips companies to PaymentOverdue and expires trials is far too destructive to switch
    /// on by surprise in a development database. Enable it per environment once the
    /// behaviour has been reviewed.
    /// </summary>
    public sealed class PlatformBillingJobOptions
    {
        public const string SectionName = "PlatformJobs";

        public bool Enabled { get; set; }

        /// <summary>How often the worker wakes up. Each job then runs at most once per day.</summary>
        public int PollMinutes { get; set; } = 60;

        /// <summary>Days of grace after the due date before a company is blocked.</summary>
        public int OverdueGraceDays { get; set; }

        /// <summary>Delete audit export packages older than this many days. Mirrors audit.exportRetentionDays.</summary>
        public int ExportRetentionDays { get; set; } = 90;
    }

    /// <summary>
    /// Runs the scheduled jobs from the specification (§8): recurring invoice generation, the
    /// overdue sweep, trial expiry and impersonation-session expiry.
    ///
    /// Every job is idempotent and logs what it did. The worker is a no-op unless
    /// <c>PlatformJobs:Enabled</c> is true.
    /// </summary>
    public sealed class PlatformBillingJobs(
        IServiceScopeFactory scopeFactory,
        IOptions<PlatformBillingJobOptions> options,
        IHostEnvironment environment,
        ILogger<PlatformBillingJobs> logger) : BackgroundService
    {
        private readonly PlatformBillingJobOptions _options = options.Value;

        /// <summary>Last calendar day each job processed, so a 60-minute poll runs daily work once.</summary>
        private DateOnly _lastInvoiceRun;
        private DateOnly _lastOverdueRun;
        private DateOnly _lastTrialRun;
        private DateOnly _lastCleanupRun;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_options.Enabled)
            {
                logger.LogInformation(
                    "Platform billing jobs are disabled (PlatformJobs:Enabled is false) in {Environment}. "
                    + "Recurring invoices, the overdue sweep and trial expiry will not run.",
                    environment.EnvironmentName);
                return;
            }

            logger.LogInformation("Platform billing jobs started; polling every {Minutes} minute(s).", _options.PollMinutes);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunDueJobsAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    // A failed run must never kill the worker: log and retry on the next poll.
                    logger.LogError(ex, "A platform billing job failed; it will be retried on the next poll.");
                }

                try
                {
                    await Task.Delay(TimeSpan.FromMinutes(Math.Max(1, _options.PollMinutes)), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }

            logger.LogInformation("Platform billing jobs stopped.");
        }

        private async Task RunDueJobsAsync(CancellationToken cancellationToken)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            using var scope = scopeFactory.CreateScope();
            var services = scope.ServiceProvider;
            var db = services.GetRequiredService<ReviveHrDbContext>();

            await ExpireImpersonationSessionsAsync(db, cancellationToken);

            if (_lastInvoiceRun != today)
            {
                var issued = await GenerateRecurringInvoicesAsync(db, today, cancellationToken);
                _lastInvoiceRun = today;
                logger.LogInformation("Invoice generation completed: {Count} invoice(s) issued.", issued);
            }

            if (_lastOverdueRun != today)
            {
                var marked = await SweepOverdueAsync(db, today, cancellationToken);
                _lastOverdueRun = today;
                logger.LogInformation("Overdue sweep completed: {Count} invoice(s) moved to Overdue.", marked);
            }

            if (_lastTrialRun != today)
            {
                var expired = await ExpireTrialsAsync(db, today, cancellationToken);
                _lastTrialRun = today;
                logger.LogInformation("Trial expiry completed: {Count} subscription(s) ended.", expired);
            }

            if (_lastCleanupRun != today)
            {
                var removed = await CleanupAuditExportsAsync(db, today, cancellationToken);
                _lastCleanupRun = today;
                logger.LogInformation("Audit export cleanup completed: {Count} package(s) removed.", removed);
            }
        }

        /// <summary>
        /// Purges audit export packages past their expiry. The trail itself is never touched —
        /// only the rendered snapshots, which are deliberately retained for a limited window.
        /// </summary>
        private async Task<int> CleanupAuditExportsAsync(
            ReviveHrDbContext db,
            DateOnly today,
            CancellationToken cancellationToken)
        {
            var now = DateTime.SpecifyKind(today.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

            var expired = await db.AuditExportPackages
                .Where(p => p.ExpiresAt < now)
                .ToListAsync(cancellationToken);

            if (expired.Count == 0)
            {
                return 0;
            }

            // Hard delete: an expired package has no further use, and leaving soft-deleted rows
            // holding their rendered content would defeat the retention window entirely.
            db.AuditExportPackages.RemoveRange(expired);
            await db.SaveChangesAsync(cancellationToken);

            return expired.Count;
        }

        /// <summary>
        /// Issues an invoice for every live paid subscription whose current period has begun
        /// but which has no invoice for this month yet.
        /// </summary>
        private async Task<int> GenerateRecurringInvoicesAsync(
            ReviveHrDbContext db,
            DateOnly today,
            CancellationToken cancellationToken)
        {
            var subscriptions = await db.CompanySubscriptions
                .Include(s => s.Plan)
                .Where(s => s.Status == SubscriptionStatus.Active)
                .ToListAsync(cancellationToken);

            if (subscriptions.Count == 0)
            {
                return 0;
            }

            var actor = await ResolveSystemActorAsync(db, cancellationToken);
            var periodStart = DateTime.SpecifyKind(new DateTime(today.Year, today.Month, 1), DateTimeKind.Utc);
            var issuedOn = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
            var issued = 0;

            foreach (var subscription in subscriptions)
            {
                if (subscription.Plan.TrialMode == TrialMode.TrialPlan)
                {
                    continue;
                }

                var exists = await db.Invoices.AnyAsync(
                    i => i.CompanyId == subscription.CompanyId
                         && i.PeriodStart == periodStart
                         && i.Status != InvoiceStatus.Void,
                    cancellationToken);

                if (exists)
                {
                    continue;
                }

                var amount = Math.Round(subscription.PriceOverride ?? subscription.Plan.Price, 2);
                if (amount <= 0)
                {
                    continue;
                }

                var invoice = new Invoice
                {
                    InvoiceNumber = await NextInvoiceNumberAsync(db, periodStart.Year, cancellationToken),
                    CompanyId = subscription.CompanyId,
                    SubscriptionId = subscription.Id,
                    PeriodStart = periodStart,
                    PeriodEnd = DateTime.SpecifyKind(periodStart.AddMonths(1).AddDays(-1), DateTimeKind.Utc),
                    PeriodLabel = periodStart.ToString("MMM yyyy"),
                    Amount = amount,
                    Currency = subscription.Plan.Currency,
                    Status = InvoiceStatus.Open,
                    IssuedOn = issuedOn,
                    DueOn = issuedOn.AddDays(30),
                };

                db.Invoices.Add(invoice);
                await db.SaveChangesAsync(cancellationToken);

                Audit(db, actor,
                    action: "Issued invoice",
                    category: "Billing",
                    severity: "info",
                    entityType: "Invoice",
                    entityId: invoice.Id,
                    companyId: subscription.CompanyId,
                    gymId: null,
                    target: $"{invoice.InvoiceNumber} · subscription #{subscription.Id}",
                    detail: $"Recurring invoice for {invoice.PeriodLabel} raised by the scheduled job.",
                    values: new { invoice.InvoiceNumber, invoice.Amount },
                    cancellationToken);

                await db.SaveChangesAsync(cancellationToken);
                issued++;
            }

            return issued;
        }

        /// <summary>
        /// Moves past-due Open invoices to Overdue, then blocks each affected company's payroll
        /// (once, no matter how many invoices are overdue).
        /// </summary>
        private async Task<int> SweepOverdueAsync(
            ReviveHrDbContext db,
            DateOnly today,
            CancellationToken cancellationToken)
        {
            var cutoff = DateTime.SpecifyKind(today.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc)
                .AddDays(-_options.OverdueGraceDays);

            var due = await db.Invoices
                .Where(i => i.Status == InvoiceStatus.Open && i.DueOn < cutoff)
                .ToListAsync(cancellationToken);

            if (due.Count == 0)
            {
                return 0;
            }

            var actor = await ResolveSystemActorAsync(db, cancellationToken);
            var affectedCompanies = due.Select(i => i.CompanyId).Distinct().ToList();

            foreach (var invoice in due)
            {
                invoice.Status = InvoiceStatus.Overdue;

                Audit(db, actor,
                    action: "Invoice became overdue",
                    category: "Billing",
                    severity: "warning",
                    entityType: "Invoice",
                    entityId: invoice.Id,
                    companyId: invoice.CompanyId,
                    gymId: null,
                    target: invoice.InvoiceNumber,
                    detail: $"Due {invoice.DueOn:yyyy-MM-dd}; {invoice.Amount:N0} {invoice.Currency} unpaid.",
                    values: null,
                    cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);

            foreach (var companyId in affectedCompanies)
            {
                var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

                if (company is null
                    || company.Status is CompanyStatus.PaymentOverdue or CompanyStatus.Suspended or CompanyStatus.Closed)
                {
                    continue;
                }

                company.Status = CompanyStatus.PaymentOverdue;

                Audit(db, actor,
                    action: "Suspended payroll access",
                    category: "Billing",
                    severity: "critical",
                    entityType: "Company",
                    entityId: company.Id,
                    companyId: company.Id,
                    gymId: null,
                    target: company.Name,
                    detail: "An invoice is overdue. Payroll is blocked until payment clears.",
                    values: null,
                    cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);
            return due.Count;
        }

        /// <summary>Ends trials that have run out and marks the subscription past due.</summary>
        private async Task<int> ExpireTrialsAsync(
            ReviveHrDbContext db,
            DateOnly today,
            CancellationToken cancellationToken)
        {
            var now = DateTime.SpecifyKind(today.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

            var expired = await db.CompanySubscriptions
                .Where(s => s.Status == SubscriptionStatus.Trial
                            && s.TrialEndsOn != null
                            && s.TrialEndsOn < now)
                .ToListAsync(cancellationToken);

            if (expired.Count == 0)
            {
                return 0;
            }

            var actor = await ResolveSystemActorAsync(db, cancellationToken);

            foreach (var subscription in expired)
            {
                subscription.Status = SubscriptionStatus.PastDue;

                Audit(db, actor,
                    action: "Trial expired",
                    category: "Billing",
                    severity: "warning",
                    entityType: "CompanySubscription",
                    entityId: subscription.Id,
                    companyId: subscription.CompanyId,
                    gymId: null,
                    target: $"Subscription #{subscription.Id}",
                    detail: "The trial ended without conversion; the subscription is now past due.",
                    values: null,
                    cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);
            return expired.Count;
        }

        /// <summary>Closes act-as sessions past their deadline.</summary>
        private async Task ExpireImpersonationSessionsAsync(ReviveHrDbContext db, CancellationToken cancellationToken)
        {
            var now = DateTime.UtcNow;

            var open = await db.ImpersonationSessions
                .Where(s => s.EndedAt == null && s.ExpiresAt < now)
                .ToListAsync(cancellationToken);

            if (open.Count == 0)
            {
                return;
            }

            foreach (var session in open)
            {
                session.EndedAt = session.ExpiresAt;
            }

            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Closed {Count} expired impersonation session(s).", open.Count);
        }

        /// <summary>
        /// The trail needs an actor. Scheduled work is attributed to the first Top Management
        /// account; when none exists the row is still written, with a null user id.
        /// </summary>
        private static async Task<DomainLayer.Models.UserModule.User> ResolveSystemActorAsync(
            ReviveHrDbContext db,
            CancellationToken cancellationToken)
        {
            var admin = await db.Users
                .Where(u => u.UserType == DomainLayer.Models.UserModule.Enums.UserType.TopManagement)
                .OrderBy(u => u.Id)
                .FirstOrDefaultAsync(cancellationToken);

            return admin ?? new DomainLayer.Models.UserModule.User
            {
                Id = 0,
                UserName = "System",
                Email = "system@revivehr.local",
            };
        }

        /// <summary>
        /// Writes one platform audit row. The job owns its own audit writes rather than
        /// reaching into the service layer's internal helper, which keeps the scheduled work
        /// decoupled from the console services.
        /// </summary>
        private static Task Audit(
            ReviveHrDbContext db,
            DomainLayer.Models.UserModule.User actor,
            string action,
            string category,
            string severity,
            string entityType,
            int entityId,
            int? companyId,
            int? gymId,
            string? target,
            string? detail,
            object? values,
            CancellationToken cancellationToken)
        {
            _ = values;

            db.AuditLogs.Add(new DomainLayer.Models.AuditModule.AuditLog
            {
                UserId = actor.Id == 0 ? null : actor.Id,
                Action = "Updated",
                ActionLabel = action,
                Category = category,
                Severity = severity,
                EntityType = entityType,
                EntityId = entityId,
                CompanyId = companyId,
                GymId = gymId,
                Target = target,
                Detail = detail,
            });

            return Task.CompletedTask;
        }

        private static async Task<string> NextInvoiceNumberAsync(
            ReviveHrDbContext db,
            int year,
            CancellationToken cancellationToken)        {
            var prefix = $"INV-{year}-";
            var numbers = await db.Invoices
                .Where(i => i.InvoiceNumber.StartsWith(prefix))
                .Select(i => i.InvoiceNumber)
                .ToListAsync(cancellationToken);

            var max = 0;
            foreach (var number in numbers)
            {
                if (int.TryParse(number[prefix.Length..], out var sequence) && sequence > max)
                {
                    max = sequence;
                }
            }

            return $"{prefix}{max + 1:D4}";
        }
    }
}
