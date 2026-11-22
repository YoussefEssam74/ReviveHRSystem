namespace Shared.DataTransferObject.Platform;

// ------------------------------------------------------------------
// Revenue analytics — §6.8
// All endpoints accept period = "Nov 2026"; omitting it selects the
// newest period on record.
// ------------------------------------------------------------------

public class RevenuePeriodsResponse
{
    public required IReadOnlyList<string> Periods { get; init; }
    public string? Current { get; init; }
}

public class RevenuePeriodQuery
{
    /// <summary>"Nov 2026" style label; omitted selects the newest period.</summary>
    public string? Period { get; init; }
}

public class MrrMetricDto
{
    public decimal Value { get; init; }
    public decimal ChangePercent { get; init; }
    public int PayingCompanies { get; init; }
    public int TotalCompanies { get; init; }
    public decimal AveragePerCompany { get; init; }
    public decimal Arr { get; init; }
}

public class GrossMetricDto
{
    public decimal Value { get; init; }
    public decimal ChangePercent { get; init; }
    public int InvoiceCount { get; init; }
    public decimal AverageInvoice { get; init; }
}

public class CollectedMetricDto
{
    public decimal Value { get; init; }
    public decimal ChangePercent { get; init; }
    public int CollectionRatePercent { get; init; }
    public int InvoicesPaid { get; init; }
}

public class OutstandingMetricDto
{
    public decimal Value { get; init; }
    public decimal ChangePercent { get; init; }
    public int ShareOfBilledPercent { get; init; }
    public int OldestDaysLate { get; init; }
}

public class RevenueSummaryResponse
{
    public required string Period { get; init; }
    public string? PreviousPeriod { get; init; }
    public required MrrMetricDto Mrr { get; init; }
    public required GrossMetricDto Gross { get; init; }
    public required CollectedMetricDto Collected { get; init; }
    public required OutstandingMetricDto Outstanding { get; init; }
}

public class RevenueTrendPoint
{
    public required string Label { get; init; }
    public required string Period { get; init; }
    public decimal Mrr { get; init; }
}

public class RevenueTrendResponse
{
    public required IReadOnlyList<RevenueTrendPoint> Series { get; init; }
    public decimal ChangePercent { get; init; }
}

public class RevenuePerCompanyRow
{
    public int CompanyId { get; init; }
    public required string CompanyName { get; init; }
    public string? City { get; init; }
    public required string Code { get; init; }
    public required string PlanName { get; init; }
    public required string CycleLabel { get; init; }
    public decimal Mrr { get; init; }
    public int MrrSharePercent { get; init; }
    public decimal Billed { get; init; }
    public decimal Collected { get; init; }
    public decimal Outstanding { get; init; }
    public DateTime? RenewsOn { get; init; }
    public string? BillingCycle { get; init; }

    /// <summary>Settled | PartPaid | Overdue | Trial.</summary>
    public required string SettlementStatus { get; init; }
}

public class RevenuePerCompanyResponse
{
    public required string Period { get; init; }
    public required IReadOnlyList<RevenuePerCompanyRow> Items { get; init; }
}

public class MrrByPlanRow
{
    public int PlanId { get; init; }
    public required string PlanName { get; init; }
    public int Companies { get; init; }
    public decimal Mrr { get; init; }
}

public class MrrPerCompanyRow
{
    public int CompanyId { get; init; }
    public required string CompanyName { get; init; }
    public required string PlanName { get; init; }
    public required string CycleLabel { get; init; }
    public int SeatsUsed { get; init; }
    public int? SeatLimit { get; init; }
    public decimal? RevenuePerSeat { get; init; }
    public decimal Mrr { get; init; }
    public int SharePercent { get; init; }
}

public class MrrBreakdownResponse
{
    public required string Period { get; init; }
    public decimal Mrr { get; init; }
    public decimal Arr { get; init; }
    public int PayingCompanies { get; init; }
    public decimal AveragePerCompany { get; init; }
    public required IReadOnlyList<MrrByPlanRow> ByPlan { get; init; }
    public required IReadOnlyList<MrrPerCompanyRow> PerCompany { get; init; }
}

public class GrossByMonthRow
{
    public required string Period { get; init; }
    public decimal Billed { get; init; }
}

public class GrossByPlanRow
{
    public int PlanId { get; init; }
    public required string PlanName { get; init; }
    public int Companies { get; init; }
    public int Invoices { get; init; }
    public decimal Billed { get; init; }
    public int ShareOfGrossPercent { get; init; }
    public decimal PreviousBilled { get; init; }
    public decimal ChangePercent { get; init; }
    public decimal Collected { get; init; }
    public int CollectionRatePercent { get; init; }
    public decimal RevenuePerCompany { get; init; }
    public int PaidCompanies { get; init; }
}

public class GrossBreakdownResponse
{
    public required string Period { get; init; }
    public decimal Gross { get; init; }
    public string? PreviousPeriod { get; init; }
    public decimal PreviousGross { get; init; }
    public decimal Change { get; init; }
    public decimal ChangePercent { get; init; }
    public decimal AverageInvoice { get; init; }
    public required IReadOnlyList<GrossByMonthRow> ByMonth { get; init; }
    public required IReadOnlyList<GrossByPlanRow> ByPlan { get; init; }
}

public class CollectedInvoiceRow
{
    public int InvoiceId { get; init; }
    public required string InvoiceNumber { get; init; }
    public int CompanyId { get; init; }
    public required string CompanyName { get; init; }
    public decimal Amount { get; init; }
    public DateTime IssuedOn { get; init; }
    public DateTime? PaidOn { get; init; }
    public int? DaysToPay { get; init; }
}

public class CollectionsResponse
{
    public required string Period { get; init; }
    public decimal Collected { get; init; }
    public int CollectionRatePercent { get; init; }
    public int InvoicesPaid { get; init; }
    public int InvoiceCount { get; init; }
    public decimal AverageDaysToPay { get; init; }
    public required IReadOnlyList<CollectedInvoiceRow> Items { get; init; }
}

public class OutstandingBucketDto
{
    public required string Key { get; init; }
    public required string Label { get; init; }
    public int Count { get; init; }
    public decimal Amount { get; init; }
}

public class OutstandingInvoiceRow
{
    public int InvoiceId { get; init; }
    public required string InvoiceNumber { get; init; }
    public int CompanyId { get; init; }
    public required string CompanyName { get; init; }
    public required string PlanName { get; init; }
    public decimal Amount { get; init; }
    public DateTime IssuedOn { get; init; }
    public DateTime DueOn { get; init; }
    public int DaysLate { get; init; }
}

public class OutstandingResponse
{
    public required string Period { get; init; }
    public decimal Outstanding { get; init; }
    public int ShareOfBilledPercent { get; init; }
    public int OldestDaysLate { get; init; }
    public required IReadOnlyList<OutstandingBucketDto> Buckets { get; init; }
    public required IReadOnlyList<OutstandingInvoiceRow> Items { get; init; }
}

public class RevenueExportQuery : RevenuePeriodQuery
{
    /// <summary>mrr | gross | collected | outstanding (default mrr).</summary>
    public string? Metric { get; init; }
}
