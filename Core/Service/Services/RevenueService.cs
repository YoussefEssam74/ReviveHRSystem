using System.Globalization;
using System.Text;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.BillingModule;
using DomainLayer.Models.BillingModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.PlatformModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Platform;

namespace Service.Services
{
    /// <summary>
    /// Revenue analytics for the console.
    ///
    /// Every figure is derived from two sources: the invoice ledger (billed / collected /
    /// outstanding) and the live subscriptions (MRR). Nothing is stored pre-aggregated, so a
    /// payment or a plan change is reflected immediately with no rollup job to lag behind.
    /// A period is a calendar month identified by its "MMM yyyy" label.
    /// </summary>
    public sealed class RevenueService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IPlatformReadRepository _readModel) : IRevenueService
    {
        public async Task<RevenuePeriodsResponse> GetPeriodsAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.revenue.view", cancellationToken);

            var periods = await _readModel.GetInvoicePeriodsAsync(cancellationToken);

            return new RevenuePeriodsResponse
            {
                Periods = periods,
                Current = periods.FirstOrDefault(),
            };
        }

        public async Task<RevenueSummaryResponse> GetSummaryAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default)
        {
            var context = await ResolveContextAsync(actorUserId, period, cancellationToken);

            var current = context.Current;
            var previous = context.Previous;

            var mrr = context.Mrr;
            var gross = current.Billed;
            var collected = current.Collected;
            var outstanding = current.Outstanding;

            return new RevenueSummaryResponse
            {
                Period = context.Period,
                PreviousPeriod = context.PreviousPeriod,
                Mrr = new MrrMetricDto
                {
                    Value = mrr,
                    ChangePercent = Percent(context.PreviousMrr, mrr),
                    PayingCompanies = context.PayingCompanies,
                    TotalCompanies = context.TotalCompanies,
                    AveragePerCompany = context.PayingCompanies > 0
                        ? Math.Round(mrr / context.PayingCompanies, 2)
                        : 0,
                    Arr = Math.Round(mrr * 12, 2),
                },
                Gross = new GrossMetricDto
                {
                    Value = gross,
                    ChangePercent = Percent(previous?.Billed ?? 0, gross),
                    InvoiceCount = current.InvoiceCount,
                    AverageInvoice = current.InvoiceCount > 0 ? Math.Round(gross / current.InvoiceCount, 2) : 0,
                },
                Collected = new CollectedMetricDto
                {
                    Value = collected,
                    ChangePercent = Percent(previous?.Collected ?? 0, collected),
                    CollectionRatePercent = gross > 0 ? (int)Math.Round(collected * 100m / gross) : 100,
                    InvoicesPaid = current.PaidCount,
                },
                Outstanding = new OutstandingMetricDto
                {
                    Value = outstanding,
                    ChangePercent = Percent(previous?.Outstanding ?? 0, outstanding),
                    ShareOfBilledPercent = gross > 0 ? (int)Math.Round(outstanding * 100m / gross) : 0,
                    OldestDaysLate = context.OldestDaysLate,
                },
            };
        }

        public async Task<RevenueTrendResponse> GetTrendAsync(int? actorUserId, int months, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.revenue.view", cancellationToken);

            var span = Math.Clamp(months <= 0 ? 12 : months, 1, 24);
            var snapshot = await _readModel.GetInvoiceSnapshotAsync(cancellationToken);

            // MRR history is reconstructed from the invoices actually raised each month:
            // the ledger is the only durable record of what was contracted at the time.
            var end = StartOfMonth(DateTime.UtcNow);
            var series = new List<RevenueTrendPoint>(span);

            for (var i = span - 1; i >= 0; i--)
            {
                var month = end.AddMonths(-i);
                var billed = snapshot
                    .Where(r => StartOfMonth(r.PeriodStart) == month)
                    .Sum(r => r.Amount);

                series.Add(new RevenueTrendPoint
                {
                    Label = month.ToString("MMM", CultureInfo.InvariantCulture),
                    Period = month.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                    Mrr = Math.Round(billed, 2),
                });
            }

            var first = series.FirstOrDefault()?.Mrr ?? 0;
            var last = series.LastOrDefault()?.Mrr ?? 0;

            return new RevenueTrendResponse
            {
                Series = series,
                ChangePercent = Percent(first, last),
            };
        }

        public async Task<RevenuePerCompanyResponse> GetPerCompanyAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default)
        {
            var context = await ResolveContextAsync(actorUserId, period, cancellationToken);
            var totalMrr = context.Mrr;

            var rows = context.Companies
                .Select(company =>
                {
                    var subscription = LiveSubscription(company);
                    var plan = subscription?.Plan;
                    var invoices = context.InvoicesFor(company.Id);
                    var billed = invoices.Sum(i => i.Amount);
                    var collected = invoices.Sum(i => i.AmountPaid);
                    var outstanding = billed - collected;

                    var mrr = subscription is null || plan is null || subscription.Status == SubscriptionStatus.Trial
                        ? 0
                        : PlatformHelpers.MonthlyValue(
                            subscription.PriceOverride ?? plan.Price, plan.CycleCount, plan.CycleUnit);

                    var settlement = invoices.Any(i => i.Status == "Overdue") ? "Overdue"
                        : subscription?.Status == SubscriptionStatus.Trial ? "Trial"
                        : outstanding > 0 ? "PartPaid"
                        : "Settled";

                    return new RevenuePerCompanyRow
                    {
                        CompanyId = company.Id,
                        CompanyName = company.Name,
                        City = company.City,
                        Code = company.Code,
                        PlanName = plan?.Name ?? "—",
                        CycleLabel = plan is null
                            ? string.Empty
                            : PlatformHelpers.CycleLabel(plan.CycleCount, plan.CycleUnit),
                        Mrr = mrr,
                        MrrSharePercent = totalMrr > 0 ? (int)Math.Round(mrr * 100m / totalMrr) : 0,
                        Billed = Math.Round(billed, 2),
                        Collected = Math.Round(collected, 2),
                        Outstanding = Math.Round(outstanding, 2),
                        RenewsOn = subscription?.RenewsOn,
                        BillingCycle = plan is null
                            ? null
                            : PlatformHelpers.CycleLabel(plan.CycleCount, plan.CycleUnit),
                        SettlementStatus = settlement,
                    };
                })
                .OrderByDescending(r => r.Mrr)
                .ThenBy(r => r.CompanyName)
                .ToList();

            return new RevenuePerCompanyResponse { Period = context.Period, Items = rows };
        }

        public async Task<MrrBreakdownResponse> GetMrrBreakdownAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default)
        {
            var context = await ResolveContextAsync(actorUserId, period, cancellationToken);
            var userCounts = await _readModel.GetUserCountsByCompanyAsync(cancellationToken);
            var totalMrr = context.Mrr;

            var perCompany = context.Companies
                .Select(company =>
                {
                    var subscription = LiveSubscription(company);
                    var plan = subscription?.Plan;

                    var mrr = subscription is null || plan is null || subscription.Status == SubscriptionStatus.Trial
                        ? 0
                        : PlatformHelpers.MonthlyValue(
                            subscription.PriceOverride ?? plan.Price, plan.CycleCount, plan.CycleUnit);

                    var seats = userCounts.TryGetValue(company.Id, out var used) ? used : 0;
                    var seatLimit = subscription?.SeatLimitOverride ?? plan?.SeatLimit;

                    return new MrrPerCompanyRow
                    {
                        CompanyId = company.Id,
                        CompanyName = company.Name,
                        PlanName = plan?.Name ?? "—",
                        CycleLabel = plan is null
                            ? string.Empty
                            : PlatformHelpers.CycleLabel(plan.CycleCount, plan.CycleUnit),
                        SeatsUsed = seats,
                        SeatLimit = seatLimit,
                        RevenuePerSeat = seatLimit is > 0 ? Math.Round(mrr / seatLimit.Value, 2) : null,
                        Mrr = mrr,
                        SharePercent = totalMrr > 0 ? (int)Math.Round(mrr * 100m / totalMrr) : 0,
                    };
                })
                .Where(r => r.Mrr > 0)
                .OrderByDescending(r => r.Mrr)
                .ToList();

            var byPlan = perCompany
                .GroupBy(r => r.PlanName)
                .Select(g => new MrrByPlanRow
                {
                    PlanId = context.Companies
                        .Select(LiveSubscription)
                        .FirstOrDefault(s => s?.Plan?.Name == g.Key)?.PlanId ?? 0,
                    PlanName = g.Key,
                    Companies = g.Count(),
                    Mrr = Math.Round(g.Sum(r => r.Mrr), 2),
                })
                .OrderByDescending(r => r.Mrr)
                .ToList();

            return new MrrBreakdownResponse
            {
                Period = context.Period,
                Mrr = Math.Round(totalMrr, 2),
                Arr = Math.Round(totalMrr * 12, 2),
                PayingCompanies = perCompany.Count,
                AveragePerCompany = perCompany.Count > 0
                    ? Math.Round(totalMrr / perCompany.Count, 2)
                    : 0,
                ByPlan = byPlan,
                PerCompany = perCompany,
            };
        }

        public async Task<GrossBreakdownResponse> GetGrossBreakdownAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default)
        {
            var context = await ResolveContextAsync(actorUserId, period, cancellationToken);

            var current = context.Current;
            var previous = context.Previous;
            var previousBilled = previous?.Billed ?? 0;

            // Gross by plan: attribute each invoice through its subscription's plan.
            var planByCompany = context.Companies
                .Select(LiveSubscription)
                .Where(s => s?.Plan is not null)
                .GroupBy(s => s!.CompanyId)
                .ToDictionary(g => g.Key, g => g.First()!.Plan!);

            var byPlan = context.PeriodInvoices
                .GroupBy(i => planByCompany.TryGetValue(i.CompanyId, out var plan) ? plan.Name : "Unattributed")
                .Select(g =>
                {
                    var billed = g.Sum(i => i.Amount);
                    var collected = g.Sum(i => i.AmountPaid);
                    var plan = planByCompany.Values.FirstOrDefault(p => p.Name == g.Key);
                    var previousBilledForPlan = previous is null
                        ? 0
                        : context.PreviousInvoices
                            .Where(i => planByCompany.TryGetValue(i.CompanyId, out var p) && p.Name == g.Key)
                            .Sum(i => i.Amount);

                    return new GrossByPlanRow
                    {
                        PlanId = plan?.Id ?? 0,
                        PlanName = g.Key,
                        Companies = g.Select(i => i.CompanyId).Distinct().Count(),
                        Invoices = g.Count(),
                        Billed = Math.Round(billed, 2),
                        ShareOfGrossPercent = current.Billed > 0
                            ? (int)Math.Round(billed * 100m / current.Billed)
                            : 0,
                        PreviousBilled = Math.Round(previousBilledForPlan, 2),
                        ChangePercent = Percent(previousBilledForPlan, billed),
                        Collected = Math.Round(collected, 2),
                        CollectionRatePercent = billed > 0 ? (int)Math.Round(collected * 100m / billed) : 100,
                        RevenuePerCompany = g.Select(i => i.CompanyId).Distinct().Count() is var companyCount && companyCount > 0
                            ? Math.Round(billed / companyCount, 2)
                            : 0,
                        PaidCompanies = g.Where(i => i.Status == "Paid").Select(i => i.CompanyId).Distinct().Count(),
                    };
                })
                .OrderByDescending(r => r.Billed)
                .ToList();

            var snapshot = context.AllInvoices;
            var byMonth = snapshot
                .GroupBy(i => StartOfMonth(i.PeriodStart))
                .OrderBy(g => g.Key)
                .TakeLast(12)
                .Select(g => new GrossByMonthRow
                {
                    Period = g.Key.ToString("MMM yyyy", CultureInfo.InvariantCulture),
                    Billed = Math.Round(g.Sum(i => i.Amount), 2),
                })
                .ToList();

            return new GrossBreakdownResponse
            {
                Period = context.Period,
                Gross = Math.Round(current.Billed, 2),
                PreviousPeriod = context.PreviousPeriod,
                PreviousGross = Math.Round(previousBilled, 2),
                Change = Math.Round(current.Billed - previousBilled, 2),
                ChangePercent = Percent(previousBilled, current.Billed),
                AverageInvoice = current.InvoiceCount > 0
                    ? Math.Round(current.Billed / current.InvoiceCount, 2)
                    : 0,
                ByMonth = byMonth,
                ByPlan = byPlan,
            };
        }

        public async Task<CollectionsResponse> GetCollectionsAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default)
        {
            var context = await ResolveContextAsync(actorUserId, period, cancellationToken);

            var paid = context.PeriodInvoices
                .Where(i => i.Status == "Paid" && i.PaidOn is not null)
                .OrderByDescending(i => i.PaidOn)
                .ToList();

            var daysToPay = paid
                .Select(i => (i.PaidOn!.Value.Date - i.IssuedOn.Date).Days)
                .Where(d => d >= 0)
                .ToList();

            return new CollectionsResponse
            {
                Period = context.Period,
                Collected = Math.Round(context.Current.Collected, 2),
                CollectionRatePercent = context.Current.Billed > 0
                    ? (int)Math.Round(context.Current.Collected * 100m / context.Current.Billed)
                    : 100,
                InvoicesPaid = paid.Count,
                InvoiceCount = context.Current.InvoiceCount,
                AverageDaysToPay = daysToPay.Count > 0
                    ? Math.Round((decimal)daysToPay.Average(), 1)
                    : 0,
                Items = paid.Select(i => new CollectedInvoiceRow
                {
                    InvoiceId = i.Id,
                    InvoiceNumber = i.InvoiceNumber,
                    CompanyId = i.CompanyId,
                    CompanyName = i.CompanyName,
                    Amount = i.Amount,
                    IssuedOn = i.IssuedOn,
                    PaidOn = i.PaidOn,
                    DaysToPay = Math.Max(0, (i.PaidOn!.Value.Date - i.IssuedOn.Date).Days),
                }).ToList(),
            };
        }

        public async Task<OutstandingResponse> GetOutstandingAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default)
        {
            var context = await ResolveContextAsync(actorUserId, period, cancellationToken);

            var unpaid = context.PeriodInvoices
                .Where(i => i.Status is "Open" or "Overdue")
                .OrderByDescending(i => DaysLate(i))
                .ToList();

            var planByCompany = context.Companies
                .Select(LiveSubscription)
                .Where(s => s?.Plan is not null)
                .GroupBy(s => s!.CompanyId)
                .ToDictionary(g => g.Key, g => g.First()!.Plan!.Name);

            // Ageing buckets mirror the console's three-way split.
            OutstandingBucketDto Bucket(string key, string label, Func<int, bool> predicate)
            {
                var rows = unpaid.Where(i => predicate(DaysLate(i))).ToList();
                return new OutstandingBucketDto
                {
                    Key = key,
                    Label = label,
                    Count = rows.Count,
                    Amount = Math.Round(rows.Sum(i => i.Amount - i.AmountPaid), 2),
                };
            }

            var buckets = new List<OutstandingBucketDto>
            {
                Bucket("current", "Current", days => days <= 0),
                Bucket("1-30", "1–30 days late", days => days is > 0 and <= 30),
                Bucket("30+", "30+ days late", days => days > 30),
            };

            var outstanding = unpaid.Sum(i => i.Amount - i.AmountPaid);

            return new OutstandingResponse
            {
                Period = context.Period,
                Outstanding = Math.Round(outstanding, 2),
                ShareOfBilledPercent = context.Current.Billed > 0
                    ? (int)Math.Round(outstanding * 100m / context.Current.Billed)
                    : 0,
                OldestDaysLate = unpaid.Count > 0 ? unpaid.Max(DaysLate) : 0,
                Buckets = buckets,
                Items = unpaid.Select(i => new OutstandingInvoiceRow
                {
                    InvoiceId = i.Id,
                    InvoiceNumber = i.InvoiceNumber,
                    CompanyId = i.CompanyId,
                    CompanyName = i.CompanyName,
                    PlanName = planByCompany.TryGetValue(i.CompanyId, out var planName) ? planName : "—",
                    Amount = Math.Round(i.Amount - i.AmountPaid, 2),
                    IssuedOn = i.IssuedOn,
                    DueOn = i.DueOn,
                    DaysLate = DaysLate(i),
                }).ToList(),
            };
        }

        public async Task<(string FileName, byte[] Content)> ExportAsync(int? actorUserId, RevenueExportQuery query, CancellationToken cancellationToken = default)
        {
            var metric = string.IsNullOrWhiteSpace(query.Metric) ? "mrr" : query.Metric.Trim().ToLowerInvariant();

            var sb = new StringBuilder();

            switch (metric)
            {
                case "gross":
                {
                    var report = await GetGrossBreakdownAsync(actorUserId, query.Period, cancellationToken);
                    sb.AppendLine("Period,Gross,Previous,Change,Change %,Average Invoice");
                    sb.AppendLine(string.Join(',',
                        Csv(report.Period), report.Gross.ToString("0.00"),
                        report.PreviousGross.ToString("0.00"), report.Change.ToString("0.00"),
                        report.ChangePercent.ToString("0.0"), report.AverageInvoice.ToString("0.00")));
                    sb.AppendLine();
                    sb.AppendLine("Plan,Companies,Invoices,Billed,Share %,Collected,Collection %,Revenue / company");
                    foreach (var row in report.ByPlan)
                    {
                        sb.AppendLine(string.Join(',',
                            Csv(row.PlanName), row.Companies, row.Invoices, row.Billed.ToString("0.00"),
                            row.ShareOfGrossPercent, row.Collected.ToString("0.00"),
                            row.CollectionRatePercent, row.RevenuePerCompany.ToString("0.00")));
                    }

                    break;
                }

                case "collected":
                {
                    var report = await GetCollectionsAsync(actorUserId, query.Period, cancellationToken);
                    sb.AppendLine("Invoice,Company,Amount,Issued,Paid,Time to pay (days)");
                    foreach (var row in report.Items)
                    {
                        sb.AppendLine(string.Join(',',
                            Csv(row.InvoiceNumber), Csv(row.CompanyName), row.Amount.ToString("0.00"),
                            row.IssuedOn.ToString("yyyy-MM-dd"), row.PaidOn?.ToString("yyyy-MM-dd") ?? "",
                            row.DaysToPay?.ToString() ?? ""));
                    }

                    break;
                }

                case "outstanding":
                {
                    var report = await GetOutstandingAsync(actorUserId, query.Period, cancellationToken);
                    sb.AppendLine("Invoice,Company,Plan,Amount,Issued,Due,Days late");
                    foreach (var row in report.Items)
                    {
                        sb.AppendLine(string.Join(',',
                            Csv(row.InvoiceNumber), Csv(row.CompanyName), Csv(row.PlanName),
                            row.Amount.ToString("0.00"), row.IssuedOn.ToString("yyyy-MM-dd"),
                            row.DueOn.ToString("yyyy-MM-dd"), row.DaysLate));
                    }

                    break;
                }

                default:
                {
                    var report = await GetMrrBreakdownAsync(actorUserId, query.Period, cancellationToken);
                    sb.AppendLine("Company,Plan,Billing,Seats used,Seat limit,Revenue / seat,MRR,Share %");
                    foreach (var row in report.PerCompany)
                    {
                        sb.AppendLine(string.Join(',',
                            Csv(row.CompanyName), Csv(row.PlanName), Csv(row.CycleLabel),
                            row.SeatsUsed, row.SeatLimit?.ToString() ?? "unlimited",
                            row.RevenuePerSeat?.ToString("0.00") ?? "",
                            row.Mrr.ToString("0.00"), row.SharePercent));
                    }

                    break;
                }
            }

            return ($"revivehr-revenue-{metric}-{DateTime.UtcNow:yyyyMMdd}.csv", Encoding.UTF8.GetBytes(sb.ToString()));
        }

        // ------------------------------------------------------------------
        // Period context
        // ------------------------------------------------------------------

        /// <summary>Everything a revenue breakdown needs, resolved once per request.</summary>
        private sealed class RevenueContext
        {
            public required string Period { get; init; }
            public string? PreviousPeriod { get; init; }
            public required IReadOnlyList<InvoiceSnapshotRow> AllInvoices { get; init; }
            public required IReadOnlyList<InvoiceSnapshotRow> PeriodInvoices { get; init; }
            public required IReadOnlyList<InvoiceSnapshotRow> PreviousInvoices { get; init; }
            public required IReadOnlyList<Company> Companies { get; init; }
            public decimal Mrr { get; init; }
            public decimal PreviousMrr { get; init; }
            public int PayingCompanies { get; init; }
            public int TotalCompanies { get; init; }

            public InvoicePeriodTotals Current => Sum(PeriodInvoices);
            public InvoicePeriodTotals? Previous => PreviousInvoices.Count > 0 ? Sum(PreviousInvoices) : null;

            public IReadOnlyList<InvoiceSnapshotRow> InvoicesFor(int companyId) =>
                PeriodInvoices.Where(i => i.CompanyId == companyId).ToList();

            public int OldestDaysLate => PeriodInvoices
                .Where(i => i.Status is "Open" or "Overdue")
                .Select(DaysLate)
                .DefaultIfEmpty(0)
                .Max();

            private static InvoicePeriodTotals Sum(IReadOnlyList<InvoiceSnapshotRow> rows) => new()
            {
                Billed = rows.Sum(r => r.Amount),
                Collected = rows.Sum(r => r.AmountPaid),
                Outstanding = rows.Sum(r => r.Amount - r.AmountPaid),
                Overdue = rows.Where(r => r.Status == "Overdue").Sum(r => r.Amount),
                InvoiceCount = rows.Count,
                PaidCount = rows.Count(r => r.Status == "Paid"),
                OverdueCount = rows.Count(r => r.Status == "Overdue"),
            };
        }

        private async Task<RevenueContext> ResolveContextAsync(int? actorUserId, string? period, CancellationToken cancellationToken)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.revenue.view", cancellationToken);

            var snapshot = await _readModel.GetInvoiceSnapshotAsync(cancellationToken);
            var periods = await _readModel.GetInvoicePeriodsAsync(cancellationToken);

            var resolved = ResolvePeriod(period, periods);
            var previousPeriod = PreviousPeriod(resolved, periods);

            var companies = (await _unitOfWork.GetRepository<Company, int>()
                .GetAllAsync(new AllCompaniesSpec(), cancellationToken)).ToList();

            var mrr = companies.Sum(company =>
            {
                var subscription = LiveSubscription(company);
                if (subscription?.Plan is null || subscription.Status == SubscriptionStatus.Trial)
                {
                    return 0m;
                }

                return PlatformHelpers.MonthlyValue(
                    subscription.PriceOverride ?? subscription.Plan.Price,
                    subscription.Plan.CycleCount,
                    subscription.Plan.CycleUnit);
            });

            var paying = companies.Count(company =>
            {
                var subscription = LiveSubscription(company);
                return subscription is not null && subscription.Status != SubscriptionStatus.Trial;
            });

            return new RevenueContext
            {
                Period = resolved,
                PreviousPeriod = previousPeriod,
                AllInvoices = snapshot,
                PeriodInvoices = snapshot.Where(i => i.PeriodLabel == resolved).ToList(),
                PreviousInvoices = previousPeriod is null
                    ? []
                    : snapshot.Where(i => i.PeriodLabel == previousPeriod).ToList(),
                Companies = companies,
                Mrr = Math.Round(mrr, 2),
                // MRR history is not stored; the previous period's contracted value is
                // approximated by its billed total, which is what the ledger recorded.
                PreviousMrr = previousPeriod is null
                    ? 0
                    : Math.Round(snapshot.Where(i => i.PeriodLabel == previousPeriod).Sum(i => i.Amount), 2),
                PayingCompanies = paying,
                TotalCompanies = companies.Count,
            };
        }

        private static string ResolvePeriod(string? requested, IReadOnlyList<string> available)
        {
            if (!string.IsNullOrWhiteSpace(requested))
            {
                return requested.Trim();
            }

            return available.FirstOrDefault() ?? DateTime.UtcNow.ToString("MMM yyyy", CultureInfo.InvariantCulture);
        }

        private static string? PreviousPeriod(string current, IReadOnlyList<string> available)
        {
            var index = available.ToList().FindIndex(p => string.Equals(p, current, StringComparison.OrdinalIgnoreCase));
            return index >= 0 && index + 1 < available.Count ? available[index + 1] : null;
        }

        private static CompanySubscription? LiveSubscription(Company company) =>
            company.Subscriptions
                .Where(s => s.Status != SubscriptionStatus.Cancelled)
                .OrderByDescending(s => s.StartedOn)
                .FirstOrDefault();

        private static int DaysLate(InvoiceSnapshotRow row) =>
            Math.Max(0, (DateTime.UtcNow.Date - row.DueOn.Date).Days);

        private static DateTime StartOfMonth(DateTime value) =>
            new(value.Year, value.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        /// <summary>
        /// Percentage change from <paramref name="from"/> to <paramref name="to"/>. When the
        /// baseline is zero the change is reported as 100 % for a non-zero result (a new
        /// value has appeared) rather than dividing by zero.
        /// </summary>
        private static decimal Percent(decimal from, decimal to)
        {
            if (from == 0)
            {
                return to == 0 ? 0 : 100m;
            }

            return Math.Round((to - from) * 100m / Math.Abs(from), 1);
        }

        private static string Csv(string? value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            return value.Contains(',') || value.Contains('"') || value.Contains('\n')
                ? $"\"{value.Replace("\"", "\"\"")}\""
                : value;
        }
    }
}
