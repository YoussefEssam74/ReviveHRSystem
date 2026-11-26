using System.Text.Json;
using DomainLayer.Constants;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.SubscriptionModule;
using DomainLayer.Models.SubscriptionModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.Subscription;

namespace Service.Services
{
    /// <summary>
    /// Subscription lifecycle and automated access control for contracted gyms.
    ///
    /// The cycle is anchored on <see cref="GymSubscription.BillingStartDate"/>: every
    /// <see cref="GymSubscription.BillingCycleMonths"/> months one invoice is raised,
    /// due on the first day of that period. A reminder goes out
    /// <see cref="SubscriptionSettings.ReminderLeadDays"/> before the due date, an
    /// overdue notice once the due date passes, and access is suspended once the
    /// grace window after the due date has elapsed. Recording the outstanding payment
    /// restores access automatically. Statuses are also evaluated on read and on the
    /// access gate, so enforcement never waits for the periodic sweep.
    /// </summary>
    public sealed class SubscriptionService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess,
        TimeZoneInfo timeZone) : ISubscriptionService
    {
        /// <summary>In-process gate for the background sweep + manual run overlap.</summary>
        private static readonly SemaphoreSlim SweepGate = new(1, 1);

        /// <summary>PostgreSQL advisory lock key shared by every app instance.</summary>
        private const int AdvisoryLockKey = 0x48525342; // "HRSB"

        private const decimal MoneyEpsilon = 0.005m;
        private const int SettingsId = 1;

        // ==================================================================
        // Read model
        // ==================================================================

        public async Task<SubscriptionOverviewResponse> GetOverviewAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            await EnsureAdminAsync(actorUserId, cancellationToken);

            var today = LocalToday();
            var settings = await GetSettingsEntityAsync(tracking: false, cancellationToken);
            var subscriptions = (await unitOfWork.GetRepository<GymSubscription, int>()
                .GetAllAsync(new GymSubscriptionsOverviewSpec(), cancellationToken)).ToList();
            var activeGyms = (await unitOfWork.GetRepository<Gym, int>()
                .GetAllAsync(new ActiveGymsSpec(), cancellationToken)).ToList();

            var configuredGymIds = subscriptions.Select(s => s.GymId).ToHashSet();
            var items = subscriptions
                .Select(s => BuildListItem(s, settings, today))
                .OrderBy(i => i.GymName, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return new SubscriptionOverviewResponse
            {
                Settings = ToSettingsDto(settings),
                Summary = new SubscriptionSummaryDto
                {
                    TotalGyms = subscriptions.Count,
                    ActiveCount = items.Count(i => i.Status == nameof(SubscriptionStatus.Active)),
                    GracePeriodCount = items.Count(i => i.Status == nameof(SubscriptionStatus.GracePeriod)),
                    SuspendedCount = items.Count(i => i.Status == nameof(SubscriptionStatus.Suspended)),
                    OverdueInvoiceCount = subscriptions.Sum(s => s.Invoices.Count(i => EffectiveInvoiceStatus(i, today) == SubscriptionInvoiceStatus.Overdue)),
                    OutstandingTotal = subscriptions.Sum(s => OutstandingOf(s.Invoices)),
                    CollectedTotal = subscriptions.SelectMany(s => s.Invoices).Sum(i => i.AmountPaid),
                },
                Items = items,
                UnconfiguredGyms = activeGyms
                    .Where(g => !configuredGymIds.Contains(g.Id))
                    .OrderBy(g => g.Name, StringComparer.OrdinalIgnoreCase)
                    .Select(g => new GymSubscriptionCandidate { GymId = g.Id, GymName = g.Name, Branch = g.Location })
                    .ToList(),
            };
        }

        public async Task<GymSubscriptionDetailResponse> GetGymSubscriptionAsync(int? actorUserId, int gymId, CancellationToken cancellationToken = default)
        {
            await EnsureAdminAsync(actorUserId, cancellationToken);
            return await BuildDetailAsync(gymId, cancellationToken);
        }

        // ==================================================================
        // Revive Admin controls
        // ==================================================================

        public async Task<SubscriptionActionResponse> SaveGymSubscriptionAsync(
            int? actorUserId, int gymId, SaveGymSubscriptionRequest request, CancellationToken cancellationToken = default)
        {
            var admin = await EnsureAdminAsync(actorUserId, cancellationToken);
            var today = LocalToday();
            var settings = await GetSettingsEntityAsync(tracking: false, cancellationToken);

            var gym = await unitOfWork.GetRepository<Gym, int>().GetByIdAsync(gymId, cancellationToken)
                ?? throw new NotFoundException("Gym not found.");
            if (gym.Status == GymStatus.Archived)
            {
                throw new BadRequestException("An archived gym cannot be billed.");
            }

            var repo = unitOfWork.GetRepository<GymSubscription, int>();
            var subscription = await repo.GetByIdAsync(new GymSubscriptionByGymIdSpec(gymId, tracking: true), cancellationToken);

            if (subscription is null)
            {
                subscription = new GymSubscription
                {
                    GymId = gymId,
                    BillingStartDate = request.BillingStartDate ?? today,
                    Status = SubscriptionStatus.Active,
                };
                await repo.AddAsync(subscription, cancellationToken);
            }
            else if (request.BillingStartDate.HasValue && subscription.Invoices.Count == 0)
            {
                // The anchor may only move while no invoice exists: re-anchoring an
                // already-billed subscription would rewrite history.
                subscription.BillingStartDate = request.BillingStartDate.Value;
            }

            subscription.Amount = request.Amount;
            subscription.BillingCycleMonths = request.BillingCycleMonths;
            subscription.GracePeriodDaysOverride = request.GracePeriodDays;
            subscription.ReminderLeadDaysOverride = request.ReminderLeadDays;
            subscription.AutoSuspensionEnabled = request.AutoSuspensionEnabled;
            if (subscription.Status == SubscriptionStatus.Cancelled)
            {
                throw new BadRequestException("A cancelled subscription cannot be edited.");
            }

            SubscriptionPlan? selectedPlan = null;
            if (request.PlanId.HasValue)
            {
                selectedPlan = await unitOfWork.GetRepository<SubscriptionPlan, int>()
                    .GetByIdAsync(new SubscriptionPlanByIdSpec(request.PlanId.Value), cancellationToken)
                    ?? throw new NotFoundException("Subscription plan not found.");
                if (!selectedPlan.IsActive && subscription.PlanId != selectedPlan.Id)
                {
                    throw new BadRequestException("An archived plan cannot be assigned to a gym.");
                }

                subscription.PlanId = selectedPlan.Id;
                if (selectedPlan.GracePeriodDays.HasValue && !request.GracePeriodDays.HasValue)
                {
                    subscription.GracePeriodDaysOverride = selectedPlan.GracePeriodDays;
                }
                if (selectedPlan.ReminderLeadDays.HasValue && !request.ReminderLeadDays.HasValue)
                {
                    subscription.ReminderLeadDaysOverride = selectedPlan.ReminderLeadDays;
                }
            }
            else
            {
                subscription.PlanId = null;
            }

            EnsureInvoices(subscription, today, settings);

            // Grace/reminder edits apply to invoices still awaiting payment.
            var graceDays = EffectiveGraceDays(subscription, settings);
            foreach (var invoice in subscription.Invoices.Where(IsUnpaid))
            {
                invoice.GraceEndsOn = invoice.DueDate.AddDays(graceDays);
            }

            // Explicit next due date: shift the outstanding invoice, or raise the
            // next cycle early when the current one is already settled.
            if (request.NextDueDate.HasValue)
            {
                if (subscription.Invoices.Count == 0)
                {
                    subscription.BillingStartDate = request.NextDueDate.Value;
                    EnsureInvoices(subscription, today, settings);
                }
                else if (!subscription.Invoices.Any(IsUnpaid))
                {
                    EnsureUpcomingInvoice(subscription, today, settings);
                }

                var target = subscription.Invoices
                    .Where(IsUnpaid)
                    .OrderBy(i => i.DueDate)
                    .FirstOrDefault();
                if (target is not null)
                {
                    target.DueDate = request.NextDueDate.Value;
                    target.GraceEndsOn = target.DueDate.AddDays(graceDays);
                }
            }

            subscription.NextDueDate = NextDueOf(subscription, today);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            await AddAuditAsync(admin.Id, "SubscriptionTermsSaved", subscription.Id, gymId,
                new
                {
                    subscription.Amount,
                    subscription.BillingCycleMonths,
                    graceDays,
                    subscription.AutoSuspensionEnabled,
                    planId = subscription.PlanId,
                    planName = selectedPlan?.Name,
                    nextDueDate = request.NextDueDate,
                },
                cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new SubscriptionActionResponse
            {
                Message = "Subscription terms saved.",
                Subscription = await BuildDetailAsync(gymId, cancellationToken),
            };
        }

        public async Task<SubscriptionActionResponse> RecordPaymentAsync(
            int? actorUserId, int gymId, RecordSubscriptionPaymentRequest request, CancellationToken cancellationToken = default)
        {
            var admin = await EnsureAdminAsync(actorUserId, cancellationToken);
            if (request.Amount <= 0)
            {
                throw new BadRequestException("The payment amount must be greater than zero.");
            }

            var settings = await GetSettingsEntityAsync(tracking: false, cancellationToken);
            var today = LocalToday();
            var subscription = await unitOfWork.GetRepository<GymSubscription, int>()
                .GetByIdAsync(new GymSubscriptionByGymIdSpec(gymId, tracking: true), cancellationToken)
                ?? throw new NotFoundException("Configure the gym's subscription before recording a payment.");
            if (subscription.Status == SubscriptionStatus.Cancelled)
            {
                throw new BadRequestException("A cancelled subscription cannot receive payments.");
            }

            // A gym may pay before the sweep has raised the current invoice.
            EnsureInvoices(subscription, today, settings);

            var unpaid = subscription.Invoices
                .Where(IsUnpaid)
                .OrderBy(i => i.DueDate)
                .ThenBy(i => i.Id)
                .ToList();
            var outstanding = unpaid.Sum(RemainingOf);
            if (outstanding <= MoneyEpsilon)
            {
                throw new BadRequestException("This gym has no outstanding subscription balance.");
            }

            if (request.Amount > outstanding + MoneyEpsilon)
            {
                throw new BadRequestException(
                    $"The payment exceeds the outstanding balance ({outstanding:0.00}).");
            }

            var paidAt = request.PaidAtUtc ?? DateTime.UtcNow;
            var remaining = request.Amount;
            var method = string.IsNullOrWhiteSpace(request.Method) ? "BankTransfer" : request.Method.Trim();
            var recorded = 0;

            foreach (var invoice in unpaid)
            {
                if (remaining <= MoneyEpsilon)
                {
                    break;
                }

                var applied = Math.Min(remaining, RemainingOf(invoice));
                if (applied <= 0)
                {
                    continue;
                }

                invoice.AmountPaid += applied;
                invoice.Payments.Add(new SubscriptionPayment
                {
                    GymId = gymId,
                    Amount = applied,
                    PaidAtUtc = paidAt,
                    Method = method,
                    Reference = request.Reference?.Trim(),
                    Notes = request.Notes?.Trim(),
                    RecordedByUserId = admin.Id,
                });
                remaining -= applied;
                recorded++;

                if (RemainingOf(invoice) <= MoneyEpsilon)
                {
                    invoice.AmountPaid = invoice.Amount;
                    invoice.Status = SubscriptionInvoiceStatus.Paid;
                    invoice.PaidAtUtc = paidAt;
                }
                else if (today > invoice.DueDate && invoice.Status == SubscriptionInvoiceStatus.Pending)
                {
                    invoice.Status = SubscriptionInvoiceStatus.Overdue;
                }
            }

            var stillUnpaid = subscription.Invoices.Any(IsUnpaid);
            var restored = false;
            if (!stillUnpaid && !subscription.IsSuspensionManual)
            {
                // Automatic suspensions are lifted by the payment itself. A manual
                // suspension (for a reason other than billing) stays in place until
                // Revive Admin reactivates it explicitly.
                restored = subscription.Status == SubscriptionStatus.Suspended;
                subscription.Status = SubscriptionStatus.Active;
                subscription.SuspendedAtUtc = null;
                subscription.SuspensionReason = null;
                subscription.AccessOverrideUntil = null;
            }

            subscription.NextDueDate = NextDueOf(subscription, today);

            await AddAuditAsync(admin.Id, "SubscriptionPaymentRecorded", subscription.Id, gymId,
                new
                {
                    request.Amount,
                    allocated = request.Amount - remaining,
                    method,
                    request.Reference,
                    paidAtUtc = paidAt,
                    restoredAccess = restored,
                    invoicesSettled = recorded,
                },
                cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            if (restored)
            {
                await NotifyGymAsync(
                    gymId,
                    "HR system access restored",
                    $"Payment of {request.Amount:0.00} was recorded for {subscription.Gym?.Name ?? "your gym"}. Your HR system access is active again.",
                    cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return new SubscriptionActionResponse
            {
                Message = restored
                    ? "Payment recorded. The gym's system access was restored automatically."
                    : "Payment recorded.",
                Subscription = await BuildDetailAsync(gymId, cancellationToken),
            };
        }

        public async Task<SubscriptionActionResponse> SuspendAsync(
            int? actorUserId, int gymId, SuspendSubscriptionRequest request, CancellationToken cancellationToken = default)
        {
            var admin = await EnsureAdminAsync(actorUserId, cancellationToken);
            var subscription = await unitOfWork.GetRepository<GymSubscription, int>()
                .GetByIdAsync(new GymSubscriptionByGymIdSpec(gymId, tracking: true), cancellationToken)
                ?? throw new NotFoundException("Gym subscription not found.");
            if (subscription.Status == SubscriptionStatus.Cancelled)
            {
                throw new BadRequestException("A cancelled subscription cannot be suspended.");
            }

            var reason = string.IsNullOrWhiteSpace(request.Reason)
                ? "Suspended manually by Revive Admin."
                : request.Reason.Trim();

            subscription.Status = SubscriptionStatus.Suspended;
            subscription.IsSuspensionManual = true;
            subscription.SuspendedAtUtc = DateTime.UtcNow;
            subscription.SuspensionReason = reason;
            subscription.AccessOverrideUntil = null;

            await AddAuditAsync(admin.Id, "SubscriptionSuspendedManually", subscription.Id, gymId, new { reason }, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            await NotifyGymAsync(
                gymId,
                "HR system access suspended",
                SubscriptionMessages.SuspensionMessage,
                cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new SubscriptionActionResponse
            {
                Message = "Subscription suspended manually.",
                Subscription = await BuildDetailAsync(gymId, cancellationToken),
            };
        }

        public async Task<SubscriptionActionResponse> ReactivateAsync(
            int? actorUserId, int gymId, ReactivateSubscriptionRequest request, CancellationToken cancellationToken = default)
        {
            var admin = await EnsureAdminAsync(actorUserId, cancellationToken);
            var settings = await GetSettingsEntityAsync(tracking: false, cancellationToken);
            var today = LocalToday();
            var subscription = await unitOfWork.GetRepository<GymSubscription, int>()
                .GetByIdAsync(new GymSubscriptionByGymIdSpec(gymId, tracking: true), cancellationToken)
                ?? throw new NotFoundException("Gym subscription not found.");
            if (subscription.Status == SubscriptionStatus.Cancelled)
            {
                throw new BadRequestException("A cancelled subscription cannot be reactivated.");
            }

            var overrideDays = Math.Clamp(
                request.OverrideDays ?? EffectiveGraceDays(subscription, settings),
                0,
                90);
            var hasOutstanding = subscription.Invoices.Any(IsUnpaid);

            subscription.Status = SubscriptionStatus.Active;
            subscription.IsSuspensionManual = false;
            subscription.SuspendedAtUtc = null;
            subscription.SuspensionReason = null;
            subscription.AccessOverrideUntil = hasOutstanding && overrideDays > 0
                ? today.AddDays(overrideDays)
                : null;

            await AddAuditAsync(admin.Id, "SubscriptionReactivatedManually", subscription.Id, gymId,
                new { overrideDays, overrideUntil = subscription.AccessOverrideUntil }, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            await NotifyGymAsync(
                gymId,
                "HR system access restored",
                hasOutstanding && subscription.AccessOverrideUntil is { } until
                    ? $"Revive Admin restored your HR system access. Access remains open until {until:yyyy-MM-dd}; please settle the outstanding subscription payment."
                    : "Revive Admin restored your HR system access.",
                cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new SubscriptionActionResponse
            {
                Message = "Subscription reactivated.",
                Subscription = await BuildDetailAsync(gymId, cancellationToken),
            };
        }

        public async Task<SubscriptionSettingsDto> UpdateSettingsAsync(
            int? actorUserId, UpdateSubscriptionSettingsRequest request, CancellationToken cancellationToken = default)
        {
            var admin = await EnsureAdminAsync(actorUserId, cancellationToken);
            var repo = unitOfWork.GetRepository<SubscriptionSettings, int>();
            var settings = await repo.GetByIdAsync(new SubscriptionSettingsSpec(tracking: true), cancellationToken);
            if (settings is null)
            {
                settings = new SubscriptionSettings { Id = SettingsId };
                await repo.AddAsync(settings, cancellationToken);
            }

            settings.DefaultBillingCycleMonths = Math.Clamp(request.DefaultBillingCycleMonths, 1, 36);
            settings.DefaultGracePeriodDays = Math.Clamp(request.DefaultGracePeriodDays, 0, 90);
            settings.ReminderLeadDays = Math.Clamp(request.ReminderLeadDays, 0, 60);
            settings.AutoSuspensionEnabled = request.AutoSuspensionEnabled;
            settings.Currency = (request.Currency ?? "EGP").Trim().ToUpperInvariant();

            await unitOfWork.SaveChangesAsync(cancellationToken);

            await AddAuditAsync(admin.Id, "SubscriptionSettingsUpdated", settings.Id, null,
                new { settings.DefaultBillingCycleMonths, settings.DefaultGracePeriodDays, settings.ReminderLeadDays, settings.AutoSuspensionEnabled, settings.Currency },
                cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);
            return ToSettingsDto(settings);
        }

        public async Task<RunSubscriptionCycleResponse> RunCycleAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            await EnsureAdminAsync(actorUserId, cancellationToken);
            var result = await RunBillingCycleWithLockAsync(cancellationToken);
            result.Message = "Billing cycle completed.";
            return result;
        }

        // ==================================================================
        // Automated cycle
        // ==================================================================

        public async Task ProcessBillingCycleAsync(CancellationToken cancellationToken = default) =>
            await RunBillingCycleWithLockAsync(cancellationToken);

        private async Task<RunSubscriptionCycleResponse> RunBillingCycleWithLockAsync(CancellationToken cancellationToken)
        {
            await SweepGate.WaitAsync(cancellationToken);
            try
            {
                RunSubscriptionCycleResponse? result = null;
                await unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    // Cross-process serialization: two app nodes sweeping together
                    // wait instead of racing the per-period unique invoice index.
                    await unitOfWork.AcquireTransactionLockAsync(AdvisoryLockKey, cancellationToken);
                    result = await RunBillingCycleCoreAsync(cancellationToken);
                }, cancellationToken);

                return result!;
            }
            finally
            {
                SweepGate.Release();
            }
        }

        private async Task<RunSubscriptionCycleResponse> RunBillingCycleCoreAsync(CancellationToken cancellationToken)
        {
            var today = LocalToday();
            var now = DateTime.UtcNow;
            var settings = await GetSettingsEntityAsync(tracking: false, cancellationToken);
            var subscriptions = (await unitOfWork.GetRepository<GymSubscription, int>()
                .GetAllAsync(new GymSubscriptionsForBillingSpec(), cancellationToken)).ToList();

            var result = new RunSubscriptionCycleResponse { GymsProcessed = subscriptions.Count };

            foreach (var subscription in subscriptions)
            {
                var graceDays = EffectiveGraceDays(subscription, settings);
                result.InvoicesCreated += EnsureInvoices(subscription, today, settings);

                // Payment reminder ahead of each due date.
                foreach (var invoice in subscription.Invoices.Where(IsUnpaid))
                {
                    var reminderLead = EffectiveReminderLeadDays(subscription, settings);
                    if (today >= invoice.DueDate.AddDays(-reminderLead)
                        && today <= invoice.DueDate
                        && invoice.ReminderSentAtUtc is null)
                    {
                        await NotifyGymAsync(
                            subscription.GymId,
                            "Subscription expiring soon",
                            $"Your HR service subscription invoice {invoice.InvoiceNumber} for {invoice.Amount:0.00} is due on {invoice.DueDate:yyyy-MM-dd}. Please renew before the due date to avoid suspension.",
                            cancellationToken);
                        invoice.ReminderSentAtUtc = now;
                        result.RemindersSent++;
                    }

                    // Overdue notice the first time the sweep sees the invoice past due.
                    if (today > invoice.DueDate && invoice.OverdueNoticeSentAtUtc is null)
                    {
                        var remaining = RemainingOf(invoice);
                        await NotifyGymAsync(
                            subscription.GymId,
                            "Subscription payment overdue",
                            $"Invoice {invoice.InvoiceNumber} ({remaining:0.00}) was due on {invoice.DueDate:yyyy-MM-dd} and is still unpaid. Access continues during the grace period ending {invoice.GraceEndsOn:yyyy-MM-dd}.",
                            cancellationToken);
                        invoice.OverdueNoticeSentAtUtc = now;
                        result.OverdueNoticesSent++;
                    }
                }

                if (subscription.IsSuspensionManual)
                {
                    subscription.NextDueDate = NextDueOf(subscription, today);
                    continue;
                }

                if (subscription.AccessOverrideUntil is { } accessUntil && accessUntil < today)
                {
                    subscription.AccessOverrideUntil = null;
                }

                var desired = ComputeEffectiveStatus(subscription, settings, today);
                var wasSuspended = subscription.Status == SubscriptionStatus.Suspended;

                if (desired == SubscriptionStatus.Suspended && !wasSuspended)
                {
                    subscription.Status = SubscriptionStatus.Suspended;
                    subscription.SuspendedAtUtc = now;
                    subscription.SuspensionReason =
                        "Automatically suspended after the subscription grace period elapsed with an unpaid invoice.";
                    subscription.IsSuspensionManual = false;

                    var trigger = subscription.Invoices
                        .Where(i => IsUnpaid(i) && today > i.GraceEndsOn)
                        .OrderBy(i => i.DueDate)
                        .FirstOrDefault();
                    if (trigger is not null)
                    {
                        trigger.AutoSuspensionAppliedAtUtc = now;
                    }

                    result.GymsSuspended++;
                    await NotifyGymAsync(
                        subscription.GymId,
                        "HR system access suspended",
                        SubscriptionMessages.SuspensionMessage,
                        cancellationToken);
                }
                else if (desired != SubscriptionStatus.Suspended && wasSuspended)
                {
                    var restored = !subscription.IsSuspensionManual;
                    subscription.Status = desired;
                    subscription.SuspendedAtUtc = null;
                    subscription.SuspensionReason = null;
                    subscription.IsSuspensionManual = false;
                    if (restored)
                    {
                        result.GymsReactivated++;
                        await NotifyGymAsync(
                            subscription.GymId,
                            "HR system access restored",
                            "Your HR system access has been restored.",
                            cancellationToken);
                    }
                }
                else if (desired == SubscriptionStatus.GracePeriod && subscription.Status != SubscriptionStatus.GracePeriod)
                {
                    subscription.Status = SubscriptionStatus.GracePeriod;
                    var graceEndsOn = subscription.Invoices
                        .Where(IsUnpaid)
                        .Select(i => (DateOnly?)i.GraceEndsOn)
                        .Min() ?? today;
                    await NotifyGymAsync(
                        subscription.GymId,
                        "Subscription grace period started",
                        $"Your HR service subscription payment is overdue. Access remains available during the grace period ending {graceEndsOn:yyyy-MM-dd}. Please complete the payment to avoid suspension.",
                        cancellationToken);
                }
                else if (desired != SubscriptionStatus.Suspended && subscription.Status != desired)
                {
                    subscription.Status = desired;
                }

                subscription.NextDueDate = NextDueOf(subscription, today);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
            return result;
        }

        // ==================================================================
        // Access gate
        // ==================================================================

        public async Task<bool> IsGymAccessAllowedAsync(int gymId, CancellationToken cancellationToken = default)
        {
            var subscription = await unitOfWork.GetRepository<GymSubscription, int>()
                .GetByIdAsync(new GymSubscriptionAccessSpec(gymId), cancellationToken);

            // A gym without a configured subscription is not blocked: rollout must
            // never lock an existing gym out before Revive Admin bills it.
            if (subscription is null)
            {
                return true;
            }

            if (subscription.Status == SubscriptionStatus.Cancelled || subscription.IsSuspensionManual)
            {
                return false;
            }

            var today = LocalToday();
            if (subscription.AccessOverrideUntil is { } until && today <= until)
            {
                return true;
            }

            // Fast path: nothing unpaid means access is allowed without reading the
            // platform settings once per request.
            if (!subscription.Invoices.Any(IsUnpaid))
            {
                return true;
            }

            var settings = await GetSettingsEntityAsync(tracking: false, cancellationToken);
            var effective = ComputeEffectiveStatus(subscription, settings, today);
            return effective is not (SubscriptionStatus.Suspended or SubscriptionStatus.Cancelled);
        }

        public async Task<IReadOnlySet<int>> GetBlockedGymIdsAsync(
            IReadOnlyCollection<int> gymIds, CancellationToken cancellationToken = default)
        {
            if (gymIds.Count == 0)
            {
                return new HashSet<int>();
            }

            var subscriptions = await unitOfWork.GetRepository<GymSubscription, int>()
                .GetAllAsync(new GymSubscriptionsByGymIdsSpec(gymIds), cancellationToken);
            var settings = await GetSettingsEntityAsync(tracking: false, cancellationToken);
            var today = LocalToday();

            return subscriptions
                .Where(s => ComputeEffectiveStatus(s, settings, today) is SubscriptionStatus.Suspended or SubscriptionStatus.Cancelled)
                .Select(s => s.GymId)
                .ToHashSet();
        }

        // ==================================================================
        // Gym-side self-service
        // ==================================================================

        public async Task<MySubscriptionResponse> GetMySubscriptionAsync(
            int? actorUserId, int gymId, CancellationToken cancellationToken = default)
        {
            var user = await EnsureAuthenticatedUserAsync(actorUserId, cancellationToken);
            await EnsureGymAdminAsync(user, gymId, cancellationToken);

            var detail = await BuildDetailAsync(gymId, cancellationToken);
            var plans = await unitOfWork.GetRepository<SubscriptionPlan, int>()
                .GetAllAsync(new ActiveSubscriptionPlansSpec(), cancellationToken);
            var pending = await unitOfWork.GetRepository<SubscriptionChangeRequest, int>()
                .GetAllAsync(new PendingSubscriptionRequestsByGymSpec(gymId), cancellationToken);

            return new MySubscriptionResponse
            {
                Subscription = detail,
                AvailablePlans = plans.Select(ToPlanDto).ToList(),
                PendingRequests = pending.Select(ToRequestDto).ToList(),
            };
        }

        public async Task<SubscriptionRequestDto> CreateMyRequestAsync(
            int? actorUserId, int gymId, CreateSubscriptionRequestRequest request, CancellationToken cancellationToken = default)
        {
            var user = await EnsureAuthenticatedUserAsync(actorUserId, cancellationToken);
            await EnsureGymAdminAsync(user, gymId, cancellationToken);

            var type = ParseRequestType(request.Type);
            var subscription = await unitOfWork.GetRepository<GymSubscription, int>()
                .GetByIdAsync(new GymSubscriptionByGymIdSpec(gymId), cancellationToken)
                ?? throw new NotFoundException("This gym does not have a subscription configured yet.");
            if (subscription.Status == SubscriptionStatus.Cancelled)
            {
                throw new BadRequestException("A cancelled subscription cannot be renewed or changed.");
            }

            var pending = await unitOfWork.GetRepository<SubscriptionChangeRequest, int>()
                .GetAllAsync(new PendingSubscriptionRequestsByGymSpec(gymId), cancellationToken);
            if (pending.Any())
            {
                throw new BadRequestException("A subscription request is already awaiting Revive Admin review.");
            }

            SubscriptionPlan? requestedPlan = null;
            if (request.RequestedPlanId.HasValue)
            {
                requestedPlan = await unitOfWork.GetRepository<SubscriptionPlan, int>()
                    .GetByIdAsync(new SubscriptionPlanByIdSpec(request.RequestedPlanId.Value), cancellationToken)
                    ?? throw new NotFoundException("Subscription plan not found.");
                if (!requestedPlan.IsActive)
                {
                    throw new BadRequestException("The selected plan is no longer available.");
                }

                if (type == SubscriptionRequestType.PlanChange && requestedPlan.Id == subscription.PlanId)
                {
                    throw new BadRequestException("Your gym is already on this plan.");
                }
            }

            if (type == SubscriptionRequestType.PlanChange && requestedPlan is null)
            {
                throw new BadRequestException("Select the plan you want to move to.");
            }

            var changeRequest = new SubscriptionChangeRequest
            {
                GymId = gymId,
                Type = type,
                Status = SubscriptionRequestStatus.Pending,
                CurrentPlanId = subscription.PlanId,
                RequestedPlanId = requestedPlan?.Id,
                RequestedByUserId = user.Id,
                Note = request.Note?.Trim(),
                RequestedAtUtc = DateTime.UtcNow,
            };

            await unitOfWork.GetRepository<SubscriptionChangeRequest, int>().AddAsync(changeRequest, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            await AddAuditAsync(user.Id, "SubscriptionRequestSubmitted", changeRequest.Id, gymId,
                new { type, requestedPlanId = requestedPlan?.Id },
                cancellationToken,
                nameof(SubscriptionChangeRequest));

            var gymName = subscription.Gym?.Name ?? $"Gym {gymId}";
            var requestedLabel = requestedPlan?.Name is { } planName
                ? $" for the {planName} plan"
                : string.Empty;
            await NotifyTopManagementAsync(
                "Subscription request",
                $"{gymName} submitted a {type} request{requestedLabel}.",
                cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new SubscriptionRequestDto
            {
                Id = changeRequest.Id,
                GymId = gymId,
                GymName = gymName,
                Type = type.ToString(),
                Status = SubscriptionRequestStatus.Pending.ToString(),
                CurrentPlanName = subscription.Plan?.Name,
                RequestedPlanName = requestedPlan?.Name,
                RequestedByUserName = user.UserName,
                Note = changeRequest.Note,
                CreatedAtUtc = changeRequest.RequestedAtUtc,
            };
        }

        // ==================================================================
        // Revive Admin request review
        // ==================================================================

        public async Task<IReadOnlyList<SubscriptionRequestDto>> GetRequestsAsync(
            int? actorUserId, string? status, CancellationToken cancellationToken = default)
        {
            await EnsureAdminAsync(actorUserId, cancellationToken);
            var statusFilter = ParseRequestStatus(status);

            var requests = await unitOfWork.GetRepository<SubscriptionChangeRequest, int>()
                .GetAllAsync(new SubscriptionChangeRequestsSpec(statusFilter), cancellationToken);
            return requests.Select(ToRequestDto).ToList();
        }

        public async Task<SubscriptionActionResponse> ApproveRequestAsync(
            int? actorUserId, int requestId, ReviewSubscriptionRequestRequest request, CancellationToken cancellationToken = default)
        {
            var admin = await EnsureAdminAsync(actorUserId, cancellationToken);
            var changeRequest = await unitOfWork.GetRepository<SubscriptionChangeRequest, int>()
                .GetByIdAsync(new SubscriptionChangeRequestByIdSpec(requestId), cancellationToken)
                ?? throw new NotFoundException("Subscription request not found.");
            if (changeRequest.Status != SubscriptionRequestStatus.Pending)
            {
                throw new BadRequestException("This subscription request has already been reviewed.");
            }

            var settings = await GetSettingsEntityAsync(tracking: false, cancellationToken);
            var today = LocalToday();
            var subscription = await unitOfWork.GetRepository<GymSubscription, int>()
                .GetByIdAsync(new GymSubscriptionByGymIdSpec(changeRequest.GymId, tracking: true), cancellationToken)
                ?? throw new NotFoundException("Gym subscription not found.");

            SubscriptionPlan? requestedPlan = null;
            if (changeRequest.RequestedPlanId.HasValue)
            {
                requestedPlan = await unitOfWork.GetRepository<SubscriptionPlan, int>()
                    .GetByIdAsync(new SubscriptionPlanByIdSpec(changeRequest.RequestedPlanId.Value), cancellationToken)
                    ?? throw new NotFoundException("Requested plan not found.");
                if (!requestedPlan.IsActive)
                {
                    throw new BadRequestException("The requested plan is archived.");
                }

                subscription.PlanId = requestedPlan.Id;
                subscription.Amount = requestedPlan.PricePerCycle;
                subscription.BillingCycleMonths = requestedPlan.BillingCycleMonths;
                if (requestedPlan.GracePeriodDays.HasValue)
                {
                    subscription.GracePeriodDaysOverride = requestedPlan.GracePeriodDays;
                }
                if (requestedPlan.ReminderLeadDays.HasValue)
                {
                    subscription.ReminderLeadDaysOverride = requestedPlan.ReminderLeadDays;
                }
            }

            EnsureInvoices(subscription, today, settings);
            if (changeRequest.Type == SubscriptionRequestType.Renewal && !subscription.Invoices.Any(IsUnpaid))
            {
                EnsureUpcomingInvoice(subscription, today, settings);
            }

            subscription.NextDueDate = NextDueOf(subscription, today);

            changeRequest.Status = SubscriptionRequestStatus.Approved;
            changeRequest.ReviewedByUserId = admin.Id;
            changeRequest.ReviewedAtUtc = DateTime.UtcNow;
            changeRequest.ReviewNote = request.Note?.Trim();

            await AddAuditAsync(admin.Id, "SubscriptionRequestApproved", changeRequest.Id, changeRequest.GymId,
                new { type = changeRequest.Type, requestedPlanId = requestedPlan?.Id },
                cancellationToken,
                nameof(SubscriptionChangeRequest));
            await unitOfWork.SaveChangesAsync(cancellationToken);

            var nextInvoice = subscription.Invoices
                .Where(IsUnpaid)
                .OrderBy(i => i.DueDate)
                .FirstOrDefault();
            var planMessage = requestedPlan is not null
                ? $" The plan is now {requestedPlan.Name} at {requestedPlan.PricePerCycle:0.00} per cycle."
                : string.Empty;
            var invoiceMessage = nextInvoice is not null
                ? $" Invoice {nextInvoice.InvoiceNumber} is due on {nextInvoice.DueDate:yyyy-MM-dd}."
                : string.Empty;

            await NotifyGymAsync(
                changeRequest.GymId,
                "Subscription request approved",
                $"{changeRequest.Type} request approved.{planMessage}{invoiceMessage}".Trim(),
                cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new SubscriptionActionResponse
            {
                Message = $"Request approved.{planMessage}{invoiceMessage}".Trim(),
                Subscription = await BuildDetailAsync(changeRequest.GymId, cancellationToken),
            };
        }

        public async Task<SubscriptionActionResponse> RejectRequestAsync(
            int? actorUserId, int requestId, ReviewSubscriptionRequestRequest request, CancellationToken cancellationToken = default)
        {
            var admin = await EnsureAdminAsync(actorUserId, cancellationToken);
            var changeRequest = await unitOfWork.GetRepository<SubscriptionChangeRequest, int>()
                .GetByIdAsync(new SubscriptionChangeRequestByIdSpec(requestId), cancellationToken)
                ?? throw new NotFoundException("Subscription request not found.");
            if (changeRequest.Status != SubscriptionRequestStatus.Pending)
            {
                throw new BadRequestException("This subscription request has already been reviewed.");
            }

            changeRequest.Status = SubscriptionRequestStatus.Rejected;
            changeRequest.ReviewedByUserId = admin.Id;
            changeRequest.ReviewedAtUtc = DateTime.UtcNow;
            changeRequest.ReviewNote = request.Note?.Trim();

            await AddAuditAsync(admin.Id, "SubscriptionRequestRejected", changeRequest.Id, changeRequest.GymId,
                new { note = changeRequest.ReviewNote },
                cancellationToken,
                nameof(SubscriptionChangeRequest));
            await unitOfWork.SaveChangesAsync(cancellationToken);

            await NotifyGymAsync(
                changeRequest.GymId,
                "Subscription request declined",
                string.IsNullOrWhiteSpace(changeRequest.ReviewNote)
                    ? "Your subscription request was declined. Please contact Revive Admin for details."
                    : $"Your subscription request was declined: {changeRequest.ReviewNote}",
                cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new SubscriptionActionResponse
            {
                Message = "Request rejected.",
                Subscription = await BuildDetailAsync(changeRequest.GymId, cancellationToken),
            };
        }

        // ==================================================================
        // Helpers
        // ==================================================================

        private async Task<User> EnsureAuthenticatedUserAsync(int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null or <= 0)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var user = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserSessionStatusSpec(actorUserId.Value), cancellationToken);
            if (user is null || !user.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            return user;
        }

        private async Task EnsureGymAdminAsync(User user, int gymId, CancellationToken cancellationToken)
        {
            if (user.UserType == UserType.TopManagement)
            {
                return;
            }

            var roles = await userAccess.GetGymRoleNamesAsync(user.Id, gymId, cancellationToken);
            if (!roles.Contains(RoleNames.BranchManager, StringComparer.Ordinal)
                && !roles.Contains(RoleNames.SuperAdmin, StringComparer.Ordinal))
            {
                throw new UnAuthorizedException(
                    "Only the gym's Branch Manager or Super Admin can view or change its subscription.");
            }
        }

        private static SubscriptionRequestType ParseRequestType(string? value) =>
            value?.Trim().ToLowerInvariant() switch
            {
                "renewal" or "renew" => SubscriptionRequestType.Renewal,
                "planchange" or "plan change" or "upgrade" or "changeplan" => SubscriptionRequestType.PlanChange,
                _ => throw new BadRequestException("Request type must be Renewal or PlanChange."),
            };

        private static SubscriptionRequestStatus? ParseRequestStatus(string? value) =>
            value?.Trim().ToLowerInvariant() switch
            {
                null or "" => SubscriptionRequestStatus.Pending,
                "pending" => SubscriptionRequestStatus.Pending,
                "approved" => SubscriptionRequestStatus.Approved,
                "rejected" => SubscriptionRequestStatus.Rejected,
                "cancelled" or "canceled" => SubscriptionRequestStatus.Cancelled,
                "all" => null,
                _ => throw new BadRequestException("Unknown subscription request status."),
            };

        private static SubscriptionPlanDto ToPlanDto(SubscriptionPlan plan) => new()
        {
            Id = plan.Id,
            Name = plan.Name,
            Description = plan.Description,
            PricePerCycle = plan.PricePerCycle,
            BillingCycleMonths = plan.BillingCycleMonths,
            GracePeriodDays = plan.GracePeriodDays,
            ReminderLeadDays = plan.ReminderLeadDays,
            IsActive = plan.IsActive,
            SortOrder = plan.SortOrder,
            GymCount = plan.Subscriptions.Count,
        };

        private static SubscriptionRequestDto ToRequestDto(SubscriptionChangeRequest request) => new()
        {
            Id = request.Id,
            GymId = request.GymId,
            GymName = request.Gym?.Name ?? $"Gym {request.GymId}",
            Type = request.Type.ToString(),
            Status = request.Status.ToString(),
            CurrentPlanName = request.CurrentPlan?.Name,
            RequestedPlanName = request.RequestedPlan?.Name,
            RequestedByUserName = request.RequestedBy?.UserName ?? "—",
            Note = request.Note,
            CreatedAtUtc = request.RequestedAtUtc,
            ReviewedAtUtc = request.ReviewedAtUtc,
            ReviewNote = request.ReviewNote,
        };

        private async Task NotifyTopManagementAsync(
            string title, string message, CancellationToken cancellationToken)
        {
            var userIds = await userAccess.GetTopManagementUserIdsAsync(cancellationToken);
            if (userIds.Count == 0)
            {
                return;
            }

            var repo = unitOfWork.GetRepository<Notification, int>();
            foreach (var userId in userIds)
            {
                await repo.AddAsync(new Notification
                {
                    UserId = userId,
                    Title = title,
                    Message = message,
                    Type = NotificationType.SystemUpdate,
                    IsRead = false,
                }, cancellationToken);
            }
        }

        private async Task<User> EnsureAdminAsync(int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null or <= 0)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var user = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserByIdSpec(actorUserId.Value), cancellationToken);
            if (user is null || !user.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            if (user.UserType != UserType.TopManagement)
            {
                throw new UnAuthorizedException("Only Revive Admin can manage gym subscriptions.");
            }

            return user;
        }

        private DateOnly LocalToday() =>
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZone));

        private async Task<SubscriptionSettings> GetSettingsEntityAsync(bool tracking, CancellationToken cancellationToken)
        {
            var repo = unitOfWork.GetRepository<SubscriptionSettings, int>();
            var settings = await repo.GetByIdAsync(new SubscriptionSettingsSpec(tracking), cancellationToken);
            if (settings is not null)
            {
                return settings;
            }

            if (tracking)
            {
                settings = new SubscriptionSettings { Id = SettingsId };
                await repo.AddAsync(settings, cancellationToken);
                return settings;
            }

            return new SubscriptionSettings { Id = SettingsId };
        }

        private async Task<GymSubscriptionDetailResponse> BuildDetailAsync(int gymId, CancellationToken cancellationToken)
        {
            var today = LocalToday();
            var settings = await GetSettingsEntityAsync(tracking: false, cancellationToken);
            var subscription = await unitOfWork.GetRepository<GymSubscription, int>()
                .GetByIdAsync(new GymSubscriptionDetailSpec(gymId), cancellationToken)
                ?? throw new NotFoundException("Gym subscription not found.");

            var payments = await unitOfWork.GetRepository<SubscriptionPayment, int>()
                .GetAllAsync(new SubscriptionPaymentsByGymSpec(gymId), cancellationToken);

            return new GymSubscriptionDetailResponse
            {
                Subscription = BuildListItem(subscription, settings, today),
                Settings = ToSettingsDto(settings),
                Invoices = subscription.Invoices
                    .OrderByDescending(i => i.PeriodStart)
                    .Select(i => new SubscriptionInvoiceDto
                    {
                        Id = i.Id,
                        InvoiceNumber = i.InvoiceNumber,
                        PeriodStart = i.PeriodStart,
                        PeriodEnd = i.PeriodEnd,
                        DueDate = i.DueDate,
                        GraceEndsOn = i.GraceEndsOn,
                        Amount = i.Amount,
                        AmountPaid = i.AmountPaid,
                        Balance = Math.Max(0, i.Amount - i.AmountPaid),
                        Status = EffectiveInvoiceStatus(i, today).ToString(),
                        IssuedAtUtc = i.IssuedAtUtc,
                        PaidAtUtc = i.PaidAtUtc,
                        ReminderSent = i.ReminderSentAtUtc is not null,
                        OverdueNoticeSent = i.OverdueNoticeSentAtUtc is not null,
                        TriggeredSuspension = i.AutoSuspensionAppliedAtUtc is not null,
                    })
                    .ToList(),
                Payments = payments.Select(p => new SubscriptionPaymentDto
                {
                    Id = p.Id,
                    InvoiceId = p.InvoiceId,
                    InvoiceNumber = p.Invoice?.InvoiceNumber ?? string.Empty,
                    Amount = p.Amount,
                    PaidAtUtc = p.PaidAtUtc,
                    Method = p.Method,
                    Reference = p.Reference,
                    Notes = p.Notes,
                    RecordedByUserId = p.RecordedByUserId,
                }).ToList(),
            };
        }

        private static GymSubscriptionListItem BuildListItem(
            GymSubscription subscription, SubscriptionSettings settings, DateOnly today)
        {
            var unpaid = subscription.Invoices.Where(IsUnpaid).OrderBy(i => i.DueDate).ToList();
            var effectiveStatus = ComputeEffectiveStatus(subscription, settings, today);
            var nextDue = unpaid.Count > 0 ? unpaid[0].DueDate : NextPeriodStart(subscription, today);
            var overdue = unpaid.Where(i => today > i.DueDate).ToList();

            return new GymSubscriptionListItem
            {
                GymId = subscription.GymId,
                GymName = subscription.Gym?.Name ?? $"Gym {subscription.GymId}",
                Branch = subscription.Gym?.Location,
                Status = effectiveStatus.ToString(),
                PlanId = subscription.PlanId,
                PlanName = subscription.Plan?.Name,
                Amount = subscription.Amount,
                Currency = settings.Currency,
                BillingCycleMonths = EffectiveCycleMonths(subscription),
                GracePeriodDays = EffectiveGraceDays(subscription, settings),
                ReminderLeadDays = EffectiveReminderLeadDays(subscription, settings),
                GracePeriodDaysOverride = subscription.GracePeriodDaysOverride,
                ReminderLeadDaysOverride = subscription.ReminderLeadDaysOverride,
                AutoSuspensionEnabled = subscription.AutoSuspensionEnabled && settings.AutoSuspensionEnabled,
                BillingStartDate = subscription.BillingStartDate,
                NextDueDate = nextDue,
                DaysUntilDue = nextDue >= today ? nextDue.DayNumber - today.DayNumber : null,
                DaysOverdue = overdue.Count > 0 ? today.DayNumber - overdue.Min(i => i.DueDate).DayNumber : 0,
                InGracePeriod = effectiveStatus == SubscriptionStatus.GracePeriod,
                OutstandingAmount = OutstandingOf(subscription.Invoices),
                UnpaidInvoiceCount = unpaid.Count,
                LastPaymentAtUtc = subscription.Invoices
                    .Where(i => i.PaidAtUtc is not null)
                    .Select(i => i.PaidAtUtc)
                    .Max(),
                SuspendedAtUtc = subscription.SuspendedAtUtc,
                SuspensionReason = subscription.SuspensionReason,
                IsSuspensionManual = subscription.IsSuspensionManual,
                CancelledAtUtc = subscription.CancelledAtUtc,
                AccessOverrideUntil = subscription.AccessOverrideUntil,
            };
        }

        private static int EnsureInvoices(
            GymSubscription subscription, DateOnly today, SubscriptionSettings settings)
        {
            if (subscription.Status == SubscriptionStatus.Cancelled)
            {
                return 0;
            }

            if (subscription.BillingStartDate > today)
            {
                return 0;
            }

            var cycleMonths = EffectiveCycleMonths(subscription);
            var graceDays = EffectiveGraceDays(subscription, settings);
            var reminderLead = EffectiveReminderLeadDays(subscription, settings);
            var currentIndex = PeriodIndex(subscription.BillingStartDate, cycleMonths, today);
            var lastIndex = currentIndex;

            // Raise the upcoming invoice as soon as its reminder window opens, so a
            // pre-due reminder can reference a real invoice.
            var nextPeriodStart = PeriodStart(subscription.BillingStartDate, cycleMonths, currentIndex + 1);
            if (nextPeriodStart <= today.AddDays(reminderLead))
            {
                lastIndex = currentIndex + 1;
            }

            var created = 0;
            for (var index = Math.Max(0, currentIndex); index <= lastIndex; index++)
            {
                var periodStart = PeriodStart(subscription.BillingStartDate, cycleMonths, index);
                var periodEnd = PeriodStart(subscription.BillingStartDate, cycleMonths, index + 1);
                if (subscription.Invoices.Any(i => i.PeriodStart == periodStart))
                {
                    continue;
                }

                subscription.Invoices.Add(new SubscriptionInvoice
                {
                    GymId = subscription.GymId,
                    InvoiceNumber = $"INV-{subscription.GymId:D4}-{periodStart:yyyyMMdd}",
                    PeriodStart = periodStart,
                    PeriodEnd = periodEnd,
                    DueDate = periodStart,
                    GraceEndsOn = periodStart.AddDays(graceDays),
                    Amount = subscription.Amount,
                    AmountPaid = 0,
                    Status = SubscriptionInvoiceStatus.Pending,
                    IssuedAtUtc = DateTime.UtcNow,
                });
                created++;
            }

            return created;
        }

        /// <summary>
        /// Raises the next cycle's invoice early (renewal approval), or returns the
        /// existing row. A future-dated agreement schedules its first period.
        /// </summary>
        private static SubscriptionInvoice EnsureUpcomingInvoice(
            GymSubscription subscription, DateOnly today, SubscriptionSettings settings)
        {
            var cycleMonths = EffectiveCycleMonths(subscription);
            var graceDays = EffectiveGraceDays(subscription, settings);
            var periodStart = today < subscription.BillingStartDate
                ? subscription.BillingStartDate
                : PeriodStart(
                    subscription.BillingStartDate,
                    cycleMonths,
                    PeriodIndex(subscription.BillingStartDate, cycleMonths, today) + 1);

            var existing = subscription.Invoices.FirstOrDefault(i => i.PeriodStart == periodStart);
            if (existing is not null)
            {
                return existing;
            }

            var invoice = new SubscriptionInvoice
            {
                GymId = subscription.GymId,
                InvoiceNumber = $"INV-{subscription.GymId:D4}-{periodStart:yyyyMMdd}",
                PeriodStart = periodStart,
                PeriodEnd = PeriodStart(subscription.BillingStartDate, cycleMonths,
                    PeriodIndex(subscription.BillingStartDate, cycleMonths, periodStart) + 1),
                DueDate = periodStart,
                GraceEndsOn = periodStart.AddDays(graceDays),
                Amount = subscription.Amount,
                AmountPaid = 0,
                Status = SubscriptionInvoiceStatus.Pending,
                IssuedAtUtc = DateTime.UtcNow,
            };
            subscription.Invoices.Add(invoice);
            return invoice;
        }

        private async Task NotifyGymAsync(
            int gymId, string title, string message, CancellationToken cancellationToken)
        {
            var userIds = await userAccess.GetGymNotificationRecipientUserIdsAsync(gymId, cancellationToken);
            if (userIds.Count == 0)
            {
                return;
            }

            var repo = unitOfWork.GetRepository<Notification, int>();
            foreach (var userId in userIds)
            {
                await repo.AddAsync(new Notification
                {
                    UserId = userId,
                    Title = title,
                    Message = message,
                    Type = NotificationType.SystemUpdate,
                    IsRead = false,
                }, cancellationToken);
            }
        }

        private async Task AddAuditAsync(
            int actorUserId, string action, int entityId, int? gymId, object values, CancellationToken cancellationToken,
            string entityType = nameof(GymSubscription))
        {
            await unitOfWork.GetRepository<AuditLog, int>().AddAsync(new AuditLog
            {
                UserId = actorUserId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                NewValues = JsonSerializer.Serialize(values),
                Timestamp = DateTime.UtcNow,
                GymId = gymId,
            }, cancellationToken);
        }

        private static SubscriptionSettingsDto ToSettingsDto(SubscriptionSettings settings) => new()
        {
            DefaultBillingCycleMonths = settings.DefaultBillingCycleMonths,
            DefaultGracePeriodDays = settings.DefaultGracePeriodDays,
            ReminderLeadDays = settings.ReminderLeadDays,
            AutoSuspensionEnabled = settings.AutoSuspensionEnabled,
            Currency = settings.Currency,
        };

        private static SubscriptionStatus ComputeEffectiveStatus(
            GymSubscription subscription, SubscriptionSettings settings, DateOnly today)
        {
            if (subscription.Status == SubscriptionStatus.Cancelled)
            {
                return SubscriptionStatus.Cancelled;
            }

            if (subscription.IsSuspensionManual)
            {
                return SubscriptionStatus.Suspended;
            }

            if (subscription.AccessOverrideUntil is { } until && today <= until)
            {
                return SubscriptionStatus.Active;
            }

            var unpaid = subscription.Invoices.Where(IsUnpaid).ToList();
            if (unpaid.Count == 0)
            {
                return SubscriptionStatus.Active;
            }

            var autoSuspends = subscription.AutoSuspensionEnabled && settings.AutoSuspensionEnabled;
            if (autoSuspends && unpaid.Any(i => today > i.GraceEndsOn))
            {
                return SubscriptionStatus.Suspended;
            }

            return unpaid.Any(i => today > i.DueDate)
                ? SubscriptionStatus.GracePeriod
                : SubscriptionStatus.Active;
        }

        private static SubscriptionInvoiceStatus EffectiveInvoiceStatus(SubscriptionInvoice invoice, DateOnly today)
        {
            if (invoice.Status == SubscriptionInvoiceStatus.Paid || invoice.AmountPaid + MoneyEpsilon >= invoice.Amount)
            {
                return SubscriptionInvoiceStatus.Paid;
            }

            if (invoice.Status == SubscriptionInvoiceStatus.Void)
            {
                return SubscriptionInvoiceStatus.Void;
            }

            return today > invoice.DueDate
                ? SubscriptionInvoiceStatus.Overdue
                : SubscriptionInvoiceStatus.Pending;
        }

        private static bool IsUnpaid(SubscriptionInvoice invoice) =>
            invoice.Status != SubscriptionInvoiceStatus.Paid
            && invoice.Status != SubscriptionInvoiceStatus.Void
            && RemainingOf(invoice) > MoneyEpsilon;

        private static decimal RemainingOf(SubscriptionInvoice invoice) =>
            Math.Max(0, invoice.Amount - invoice.AmountPaid);

        private static decimal OutstandingOf(IEnumerable<SubscriptionInvoice> invoices) =>
            invoices.Where(IsUnpaid).Sum(RemainingOf);

        private static int EffectiveCycleMonths(GymSubscription subscription) =>
            Math.Clamp(subscription.BillingCycleMonths <= 0 ? 1 : subscription.BillingCycleMonths, 1, 36);

        private static int EffectiveGraceDays(GymSubscription subscription, SubscriptionSettings settings) =>
            Math.Clamp(subscription.GracePeriodDaysOverride ?? settings.DefaultGracePeriodDays, 0, 90);

        private static int EffectiveReminderLeadDays(GymSubscription subscription, SubscriptionSettings settings) =>
            Math.Clamp(subscription.ReminderLeadDaysOverride ?? settings.ReminderLeadDays, 0, 60);

        private static DateOnly PeriodStart(DateOnly anchor, int cycleMonths, int index) =>
            anchor.AddMonths(index * cycleMonths);

        private static int PeriodIndex(DateOnly anchor, int cycleMonths, DateOnly date)
        {
            var months = (date.Year - anchor.Year) * 12 + (date.Month - anchor.Month);
            var index = months / cycleMonths;
            if (date < PeriodStart(anchor, cycleMonths, index))
            {
                index--;
            }

            return Math.Max(0, index);
        }

        private static DateOnly NextPeriodStart(GymSubscription subscription, DateOnly today)
        {
            if (today < subscription.BillingStartDate)
            {
                return subscription.BillingStartDate;
            }

            var cycleMonths = EffectiveCycleMonths(subscription);
            var index = PeriodIndex(subscription.BillingStartDate, cycleMonths, today);
            return PeriodStart(subscription.BillingStartDate, cycleMonths, index + 1);
        }

        private static DateOnly NextDueOf(GymSubscription subscription, DateOnly today)
        {
            var nextUnpaid = subscription.Invoices
                .Where(IsUnpaid)
                .OrderBy(i => i.DueDate)
                .FirstOrDefault();
            return nextUnpaid?.DueDate ?? NextPeriodStart(subscription, today);
        }
    }
}
