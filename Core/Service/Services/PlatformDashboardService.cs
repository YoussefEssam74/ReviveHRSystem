using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.BillingModule;
using DomainLayer.Models.BillingModule.Enums;
using DomainLayer.Models.PlatformModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Platform;

namespace Service.Services
{
    /// <summary>
    /// The console's landing page, the derived attention queue, user growth and the header
    /// search. Everything here is <em>derived</em> at read time — no alert is stored, so
    /// resolving the underlying issue clears it on the next load.
    /// </summary>
    public sealed class PlatformDashboardService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IPlatformReadRepository _readModel) : IPlatformDashboardService
    {
        /// <summary>Seats at or above this percentage raise a warning alert.</summary>
        private const int SeatPressureThreshold = 75;

        /// <summary>A trial inside this window raises a warning alert.</summary>
        private const int TrialWarningDays = 14;

        /// <summary>Failed sign-ins needed inside the window to raise a security alert.</summary>
        private const int FailedSignInThreshold = 5;
        private const int FailedSignInWindowMinutes = 15;

        public async Task<PlatformDashboardResponse> GetDashboardAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.view", cancellationToken);

            var companies = await _readModel.GetCompanyStatusTotalsAsync(cancellationToken);
            var users = await _readModel.GetUserTotalsAsync(cancellationToken);
            var invoices = await _readModel.GetInvoiceTotalsAsync(PlatformHelpers.CurrentMonthStart(), cancellationToken);
            var seats = await _readModel.GetSeatUsageAsync(cancellationToken);
            var alerts = await BuildAlertsAsync(cancellationToken);

            var mrr = await ComputeMrrAsync(cancellationToken);

            return new PlatformDashboardResponse
            {
                Companies = new DashboardCompanyCountsDto
                {
                    Total = companies.Total,
                    Active = companies.Active,
                    Trial = companies.Trial,
                    PaymentOverdue = companies.PaymentOverdue,
                    Suspended = companies.Suspended,
                },
                Users = new DashboardUserCountsDto
                {
                    Total = users.Total,
                    GymMembers = users.GymMembers,
                    PlatformUsers = users.PlatformUsers,
                    HrManagers = users.HrManagers,
                    AddedThisMonth = users.AddedThisMonth,
                },
                Revenue = new DashboardRevenueDto
                {
                    Mrr = mrr,
                    Arr = mrr * 12,
                    Overdue = invoices.Overdue,
                    BilledThisMonth = invoices.Billed,
                    CollectedThisMonth = invoices.Collected,
                },
                Seats = new DashboardSeatsDto
                {
                    Used = seats.Used,
                    Capacity = seats.Capacity,
                    UtilisationPercent = seats.Capacity > 0
                        ? (int)Math.Round(seats.Used * 100.0 / seats.Capacity)
                        : 0,
                },
                Attention = new DashboardAttentionDto
                {
                    Critical = alerts.Count(a => a.Severity == "critical"),
                    Warnings = alerts.Count(a => a.Severity == "warning"),
                    Total = alerts.Count,
                },
            };
        }

        public async Task<PlatformAlertListResponse> GetAlertsAsync(int? actorUserId, PlatformAlertQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.view", cancellationToken);

            var alerts = await BuildAlertsAsync(cancellationToken);

            if (!string.IsNullOrWhiteSpace(query.Severity))
            {
                var severity = query.Severity.Trim().ToLowerInvariant();
                alerts = alerts.Where(a => string.Equals(a.Severity, severity, StringComparison.OrdinalIgnoreCase)).ToList();
            }

            if (query.CompanyId is int companyId)
            {
                alerts = alerts.Where(a => a.CompanyId == companyId).ToList();
            }

            return new PlatformAlertListResponse
            {
                Items = alerts,
                Counts = new PlatformAlertCountsDto
                {
                    Critical = alerts.Count(a => a.Severity == "critical"),
                    Warning = alerts.Count(a => a.Severity == "warning"),
                    Info = alerts.Count(a => a.Severity == "info"),
                    Total = alerts.Count,
                },
            };
        }

        public async Task<UserGrowthResponse> GetUserGrowthAsync(int? actorUserId, int months, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.view", cancellationToken);

            var buckets = await _readModel.GetUserGrowthAsync(months, cancellationToken);

            return new UserGrowthResponse
            {
                Series = buckets
                    .Select(b => new UserGrowthPoint
                    {
                        Label = new DateTime(b.Year, b.Month, 1).ToString("MMM"),
                        Period = $"{b.Year:D4}-{b.Month:D2}",
                        Users = b.Users,
                    })
                    .ToList(),
            };
        }

        public async Task<PlatformSearchResponse> SearchAsync(int? actorUserId, string query, int limit, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.view", cancellationToken);

            if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
            {
                // A single keystroke should not raise an error toast in the header search;
                // a too-short term simply returns nothing.
                return new PlatformSearchResponse
                {
                    Companies = [],
                    Users = [],
                    Invoices = [],
                };
            }

            var term = query.Trim().ToLowerInvariant();
            var take = Math.Clamp(limit, 1, 25);

            var companies = await _unitOfWork.GetRepository<Company, int>()
                .GetAllAsync(new AllCompaniesSpec(), cancellationToken);

            var companyHits = companies
                .Where(c => c.Name.ToLowerInvariant().Contains(term)
                            || c.Code.ToLowerInvariant().Contains(term)
                            || (c.City?.ToLowerInvariant().Contains(term) ?? false))
                .Take(take)
                .Select(c => new PlatformSearchCompanyHit
                {
                    Id = c.Id,
                    Name = c.Name,
                    City = c.City,
                    Code = c.Code,
                })
                .ToList();

            var users = await _unitOfWork.GetRepository<DomainLayer.Models.UserModule.User, int>()
                .GetAllAsync(cancellationToken);

            var companyNames = await _readModel.GetCompanyNamesAsync(cancellationToken);
            var companyMap = await _readModel.GetUserCompanyMapAsync(cancellationToken);

            var userHits = users
                .Where(u => u.UserName.ToLowerInvariant().Contains(term) || u.Email.ToLowerInvariant().Contains(term))
                .Take(take)
                .Select(u =>
                {
                    var ids = companyMap.TryGetValue(u.Id, out var list) ? list : [];
                    var primary = ids.FirstOrDefault();
                    return new PlatformSearchUserHit
                    {
                        Id = u.Id,
                        Name = u.UserName,
                        Email = u.Email,
                        CompanyName = ids.Count > 1
                            ? $"{ids.Count} companies"
                            : primary != 0 && companyNames.TryGetValue(primary, out var name) ? name : null,
                    };
                })
                .ToList();

            var invoices = await _unitOfWork.GetRepository<Invoice, int>()
                .GetAllAsync(cancellationToken);

            var invoiceHits = invoices
                .Where(i => i.InvoiceNumber.ToLowerInvariant().Contains(term) || i.PeriodLabel.ToLowerInvariant().Contains(term))
                .Take(take)
                .Select(i => new PlatformSearchInvoiceHit
                {
                    Id = i.Id,
                    InvoiceNumber = i.InvoiceNumber,
                    CompanyName = companyNames.TryGetValue(i.CompanyId, out var name) ? name : $"#{i.CompanyId}",
                    Amount = i.Amount,
                    Status = PlatformHelpers.InvoiceStatusLabel(i.Status),
                })
                .ToList();

            return new PlatformSearchResponse
            {
                Companies = companyHits,
                Users = userHits,
                Invoices = invoiceHits,
            };
        }

        // ------------------------------------------------------------------
        // Derived alerts
        // ------------------------------------------------------------------

        /// <summary>
        /// Builds the attention queue from live state, critical first. Each source maps to a
        /// specific <c>Type</c> so the console can deep-link to the right tab.
        /// </summary>
        private async Task<List<PlatformAlertItem>> BuildAlertsAsync(CancellationToken cancellationToken)
        {
            var alerts = new List<PlatformAlertItem>();

            var overdue = await _readModel.GetOverdueInvoicesAsync(cancellationToken);
            foreach (var invoice in overdue)
            {
                alerts.Add(new PlatformAlertItem
                {
                    Id = $"InvoiceOverdue:{invoice.InvoiceId}",
                    Severity = "critical",
                    Type = "InvoiceOverdue",
                    Title = $"{invoice.CompanyName} invoice overdue",
                    Detail = $"{invoice.Amount:N0} due {invoice.DaysOverdue} day(s) ago · payroll blocked",
                    CompanyId = invoice.CompanyId,
                    CompanyName = invoice.CompanyName,
                    ActionLabel = "Review company",
                    ActionTarget = "company-detail",
                    RaisedAt = invoice.DueOn,
                });
            }

            var failedSignIns = await _readModel.GetFailedSignInBurstsAsync(
                FailedSignInThreshold, FailedSignInWindowMinutes, cancellationToken);

            foreach (var burst in failedSignIns)
            {
                alerts.Add(new PlatformAlertItem
                {
                    Id = $"FailedSignIn:{burst.UserId}",
                    Severity = "critical",
                    Type = "FailedSignInBurst",
                    Title = "Blocked sign-in attempts",
                    Detail = $"{burst.Email} · {burst.Attempts} failures from {burst.IpAddress ?? "an unknown address"}",
                    CompanyId = null,
                    CompanyName = null,
                    UserId = burst.UserId,
                    ActionLabel = "Review user",
                    ActionTarget = "user-detail",
                    RaisedAt = burst.LastAttemptAt,
                });
            }

            var trials = await _readModel.GetTrialsEndingAsync(TrialWarningDays, cancellationToken);
            foreach (var trial in trials)
            {
                alerts.Add(new PlatformAlertItem
                {
                    Id = $"TrialEnding:{trial.CompanyId}",
                    Severity = "warning",
                    Type = "TrialEnding",
                    Title = $"{trial.CompanyName} trial ends in {trial.DaysRemaining} days",
                    Detail = $"{trial.PlanName} trial · {trial.Users} of {trial.SeatLimit?.ToString() ?? "unlimited"} seats used",
                    CompanyId = trial.CompanyId,
                    CompanyName = trial.CompanyName,
                    ActionLabel = "Review company",
                    ActionTarget = "company-detail",
                    RaisedAt = trial.TrialEndsOn,
                });
            }

            var seatPressure = await _readModel.GetSeatPressureAsync(SeatPressureThreshold, cancellationToken);
            foreach (var row in seatPressure)
            {
                alerts.Add(new PlatformAlertItem
                {
                    Id = $"SeatQuotaNearLimit:{row.CompanyId}",
                    Severity = "warning",
                    Type = "SeatQuotaNearLimit",
                    Title = $"{row.CompanyName} at {row.UsagePercent}% of its seat quota",
                    Detail = $"{row.Users} of {row.SeatLimit} seats used · {Math.Max(0, row.SeatLimit - row.Users)} left",
                    CompanyId = row.CompanyId,
                    CompanyName = row.CompanyName,
                    ActionLabel = "Review seats",
                    ActionTarget = "company-detail",
                    RaisedAt = null,
                });
            }

            var payroll = await BuildPayrollAlertsAsync(cancellationToken);
            alerts.AddRange(payroll);

            return alerts
                .OrderBy(a => a.Severity switch { "critical" => 0, "warning" => 1, _ => 2 })
                .ThenByDescending(a => a.RaisedAt ?? DateTime.MinValue)
                .ToList();
        }

        /// <summary>Companies whose current payroll run is submitted but not yet signed off.</summary>
        private async Task<List<PlatformAlertItem>> BuildPayrollAlertsAsync(CancellationToken cancellationToken)
        {
            var companies = await _unitOfWork.GetRepository<Company, int>()
                .GetAllAsync(new AllCompaniesSpec(), cancellationToken);

            var alerts = new List<PlatformAlertItem>();

            foreach (var company in companies)
            {
                var period = await _unitOfWork.GetRepository<DomainLayer.Models.PayrollModule.PayrollPeriod, int>()
                    .GetByIdAsync(new LatestPayrollPeriodForCompanySpec(company.Id), cancellationToken);

                if (period is null
                    || period.Status != DomainLayer.Models.PayrollModule.Enums.PayrollPeriodStatus.Approved)
                {
                    continue;
                }

                alerts.Add(new PlatformAlertItem
                {
                    Id = $"PayrollAwaitingApproval:{company.Id}",
                    Severity = "warning",
                    Type = "PayrollAwaitingApproval",
                    Title = $"{company.Name} payroll awaiting approval",
                    Detail = $"{period.StartDate:MMM yyyy} run submitted and waiting for sign-off",
                    CompanyId = company.Id,
                    CompanyName = company.Name,
                    ActionLabel = "Review payroll",
                    ActionTarget = "company-detail",
                    RaisedAt = period.ApprovedAt,
                });
            }

            return alerts;
        }

        /// <summary>Monthly recurring revenue across live, non-trial subscriptions.</summary>
        private async Task<decimal> ComputeMrrAsync(CancellationToken cancellationToken)
        {
            var companies = await _unitOfWork.GetRepository<Company, int>()
                .GetAllAsync(new AllCompaniesSpec(), cancellationToken);

            decimal total = 0;
            foreach (var company in companies)
            {
                var subscription = company.Subscriptions
                    .Where(s => s.Status != SubscriptionStatus.Cancelled)
                    .OrderByDescending(s => s.StartedOn)
                    .FirstOrDefault();

                if (subscription?.Plan is null || subscription.Status == SubscriptionStatus.Trial)
                {
                    continue;
                }

                total += PlatformHelpers.MonthlyValue(
                    subscription.PriceOverride ?? subscription.Plan.Price,
                    subscription.Plan.CycleCount,
                    subscription.Plan.CycleUnit);
            }

            return total;
        }
    }
}
