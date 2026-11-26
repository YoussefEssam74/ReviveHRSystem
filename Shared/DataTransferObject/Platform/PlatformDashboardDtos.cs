namespace Shared.DataTransferObject.Platform;

// ------------------------------------------------------------------
// Dashboard — §6.1
// ------------------------------------------------------------------

public class DashboardCompanyCountsDto
{
    public int Total { get; init; }
    public int Active { get; init; }
    public int Trial { get; init; }
    public int PaymentOverdue { get; init; }
    public int Suspended { get; init; }
}

public class DashboardUserCountsDto
{
    public int Total { get; init; }
    public int GymMembers { get; init; }
    public int PlatformUsers { get; init; }
    public int HrManagers { get; init; }
    public int AddedThisMonth { get; init; }
}

public class DashboardRevenueDto
{
    public decimal Mrr { get; init; }
    public decimal Arr { get; init; }
    public decimal Overdue { get; init; }
    public decimal BilledThisMonth { get; init; }
    public decimal CollectedThisMonth { get; init; }
}

public class DashboardSeatsDto
{
    public int Used { get; init; }

    /// <summary>Only capped plans count toward capacity, so unlimited tenants never skew the ratio.</summary>
    public int Capacity { get; init; }

    public int UtilisationPercent { get; init; }
}

public class DashboardAttentionDto
{
    public int Critical { get; init; }
    public int Warnings { get; init; }
    public int Total { get; init; }
}

public class PlatformDashboardResponse
{
    public required DashboardCompanyCountsDto Companies { get; init; }
    public required DashboardUserCountsDto Users { get; init; }
    public required DashboardRevenueDto Revenue { get; init; }
    public required DashboardSeatsDto Seats { get; init; }
    public required DashboardAttentionDto Attention { get; init; }
}

// ------------------------------------------------------------------
// Attention queue — derived, never stored
// ------------------------------------------------------------------

public class PlatformAlertItem
{
    /// <summary>Stable synthetic id: "{type}:{entityId}".</summary>
    public required string Id { get; init; }

    /// <summary>critical | warning | info.</summary>
    public required string Severity { get; init; }

    /// <summary>InvoiceOverdue | TrialEnding | SeatQuotaNearLimit | PayrollAwaitingApproval | FailedSignInBurst.</summary>
    public required string Type { get; init; }

    public required string Title { get; init; }
    public required string Detail { get; init; }
    public int? CompanyId { get; init; }
    public string? CompanyName { get; init; }

    /// <summary>The account the alert is about, when it points at a single user.</summary>
    public int? UserId { get; init; }

    public required string ActionLabel { get; init; }
    public required string ActionTarget { get; init; }
    public DateTime? RaisedAt { get; init; }
}

public class PlatformAlertCountsDto
{
    public int Critical { get; init; }
    public int Warning { get; init; }
    public int Info { get; init; }
    public int Total { get; init; }
}

public class PlatformAlertListResponse
{
    public required IReadOnlyList<PlatformAlertItem> Items { get; init; }
    public required PlatformAlertCountsDto Counts { get; init; }
}

public class PlatformAlertQuery
{
    /// <summary>critical | warning | info; omitted returns every severity.</summary>
    public string? Severity { get; init; }

    public int? CompanyId { get; init; }
}

// ------------------------------------------------------------------
// User-growth trend
// ------------------------------------------------------------------

public class UserGrowthPoint
{
    public required string Label { get; init; }
    public required string Period { get; init; }
    public int Users { get; init; }
}

public class UserGrowthResponse
{
    public required IReadOnlyList<UserGrowthPoint> Series { get; init; }
}

// ------------------------------------------------------------------
// Global search — §6.13
// ------------------------------------------------------------------

public class PlatformSearchCompanyHit
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public string? City { get; init; }
    public required string Code { get; init; }
}

public class PlatformSearchUserHit
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public required string Email { get; init; }
    public string? CompanyName { get; init; }
}

public class PlatformSearchInvoiceHit
{
    public int Id { get; init; }
    public required string InvoiceNumber { get; init; }
    public required string CompanyName { get; init; }
    public decimal Amount { get; init; }
    public required string Status { get; init; }
}

public class PlatformSearchResponse
{
    public required IReadOnlyList<PlatformSearchCompanyHit> Companies { get; init; }
    public required IReadOnlyList<PlatformSearchUserHit> Users { get; init; }
    public required IReadOnlyList<PlatformSearchInvoiceHit> Invoices { get; init; }
}
