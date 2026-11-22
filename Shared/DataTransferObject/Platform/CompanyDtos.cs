namespace Shared.DataTransferObject.Platform;

// ------------------------------------------------------------------
// Companies (gym accounts) — Super Admin console, §6.2
// ------------------------------------------------------------------

/// <summary>
/// Query options for the company list: free-text search, status/plan filters,
/// sort key and pager. The console's table is dense, so the default page size is
/// larger than the generic 10.
/// </summary>
public class CompanyListQuery
{
    /// <summary>Case-insensitive substring of name, code or city.</summary>
    public string? Search { get; init; }

    /// <summary>Trial | Active | PaymentOverdue | Suspended | Closed.</summary>
    public string? Status { get; init; }

    public int? PlanId { get; init; }

    /// <summary>name (default) | plan | branches | users | seats | mrr | renewsOn | status.</summary>
    public string? SortBy { get; init; }

    /// <summary>asc (default) | desc.</summary>
    public string? SortDir { get; init; }

    public int PageNumber { get; init; } = 1;
    public int PageSize { get; init; } = 25;
}

/// <summary>One company row in the account table.</summary>
public class CompanyListItem
{
    public int Id { get; init; }
    public required string Code { get; init; }
    public required string Name { get; init; }
    public string? City { get; init; }
    public string? LogoUrl { get; init; }

    /// <summary>Display status: Trial | Active | Payment overdue | Suspended | Closed.</summary>
    public required string Status { get; init; }

    public required PlanRef Plan { get; init; }

    public int BranchCount { get; init; }
    public int UserCount { get; init; }

    /// <summary>Null when the plan is uncapped.</summary>
    public int? SeatLimit { get; init; }

    /// <summary>Null when the plan is uncapped.</summary>
    public int? SeatUsagePercent { get; init; }

    public decimal Mrr { get; init; }
    public string? BillingCycle { get; init; }
    public DateTime? SubscribedOn { get; init; }
    public DateTime? RenewsOn { get; init; }
    public int? RenewalDaysRemaining { get; init; }
    public string? PayrollStatus { get; init; }
}

public class CompanyListResponse
{
    public required IReadOnlyList<CompanyListItem> Items { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages { get; init; }
}

/// <summary>Minimal plan reference embedded in company rows.</summary>
public class PlanRef
{
    public int Id { get; init; }
    public required string Name { get; init; }
}

public class CompanyContactDto
{
    public string? Name { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
}

/// <summary>Active commercial agreement embedded in a company detail.</summary>
public class CompanySubscriptionDto
{
    public int Id { get; init; }
    public int PlanId { get; init; }
    public required string PlanName { get; init; }

    /// <summary>Trial | Active | PastDue | Cancelled.</summary>
    public required string Status { get; init; }

    public decimal Price { get; init; }
    public int CycleCount { get; init; }

    /// <summary>Months | Years.</summary>
    public required string CycleUnit { get; init; }

    public int? SeatLimit { get; init; }
    public int? BranchLimit { get; init; }
    public DateTime StartedOn { get; init; }
    public DateTime CurrentPeriodStart { get; init; }
    public DateTime CurrentPeriodEnd { get; init; }
    public DateTime? TrialEndsOn { get; init; }
    public DateTime? RenewsOn { get; init; }
}

/// <summary>Counter strip of a company detail header (the console's tab badges).</summary>
public class CompanyCountsDto
{
    public int Branches { get; init; }
    public int Users { get; init; }
    public int HrStaff { get; init; }
    public int Invoices { get; init; }
    public int AuditEvents { get; init; }
}

public class CompanyHealthDto
{
    public int Score { get; init; }
    public DateTime? LastActivityAt { get; init; }
    public int? AttendanceRate30d { get; init; }
}

/// <summary>Why the account is degraded, when it is (drives the amber banner).</summary>
public class CompanyBlockingDto
{
    public bool PayrollBlocked { get; init; }
    public string? Reason { get; init; }
}

public class CompanyDetailResponse
{
    public int Id { get; init; }
    public required string Code { get; init; }
    public required string Name { get; init; }
    public string? City { get; init; }
    public string? LogoUrl { get; init; }
    public required string Status { get; init; }
    public required CompanyContactDto Contact { get; init; }
    public DateTime CreatedAt { get; init; }
    public CompanySubscriptionDto? Subscription { get; init; }
    public required CompanyCountsDto Counts { get; init; }
    public required CompanyHealthDto Health { get; init; }
    public string? PayrollStatus { get; init; }
    public required CompanyBlockingDto Blocking { get; init; }
}

/// <summary>Primary branch created with the company (step 1 of the wizard).</summary>
public class CompanyPrimaryBranchRequest
{
    public required string Name { get; init; }
    public string? Area { get; init; }
    public string? Address { get; init; }
    public string? Phone { get; init; }
}

public class CompanySubscriptionRequest
{
    public int PlanId { get; init; }

    /// <summary>Start on the plan's free trial instead of billing immediately.</summary>
    public bool StartTrial { get; init; }
}

/// <summary>Create-company body — one transaction covering company + branch + subscription + HR grants.</summary>
public class CreateCompanyRequest
{
    public required string Name { get; init; }
    public required string Code { get; init; }
    public string? City { get; init; }
    public string? LogoUrl { get; init; }
    public required CompanyPrimaryBranchRequest PrimaryBranch { get; init; }
    public required CompanyContactDto Contact { get; init; }
    public required CompanySubscriptionRequest Subscription { get; init; }

    /// <summary>HR users granted this company immediately.</summary>
    public List<int>? HrStaffIds { get; init; }

    /// <summary>Defer HR assignment to an HR Manager later (mutually exclusive with HrStaffIds).</summary>
    public bool AssignHrLater { get; init; }
}

public class CreateCompanyResponse
{
    public int Id { get; init; }
    public required string Code { get; init; }
    public required string Name { get; init; }
    public required string Status { get; init; }
    public int PrimaryBranchId { get; init; }
    public required CompanySubscriptionSummaryDto Subscription { get; init; }
    public int AssignedHrStaffCount { get; init; }
    public DateTime CreatedAt { get; init; }
}

public class CompanySubscriptionSummaryDto
{
    public int PlanId { get; init; }
    public required string PlanName { get; init; }
    public required string Status { get; init; }
    public DateTime? TrialEndsOn { get; init; }
    public int? SeatLimit { get; init; }
    public int? BranchLimit { get; init; }
    public decimal Mrr { get; init; }
}

/// <summary>Edit-company body. The code is immutable — it prefixes every branch code.</summary>
public class UpdateCompanyRequest
{
    public required string Name { get; init; }
    public string? City { get; init; }
    public string? LogoUrl { get; init; }
    public required CompanyContactDto Contact { get; init; }
}

public class UpdateCompanyStatusRequest
{
    /// <summary>Suspended | Active | Closed.</summary>
    public required string Status { get; init; }

    /// <summary>Required when suspending; must be omitted when restoring.</summary>
    public string? Reason { get; init; }

    /// <summary>Required when closing — must match the company code.</summary>
    public string? ConfirmCode { get; init; }
}

public class CompanyStatusChangeResponse
{
    public int Id { get; init; }
    public required string Status { get; init; }
    public bool PayrollBlocked { get; init; }
    public bool SignInBlocked { get; init; }
    public int SessionsRevoked { get; init; }
    public DateTime ChangedAt { get; init; }
}

public class CompanyRoleBreakdownDto
{
    public int Hr { get; init; }
    public int BranchManager { get; init; }
    public int TeamLeader { get; init; }
    public int Employee { get; init; }
    public int Total { get; init; }
}

public class CompanyAccountFactsDto
{
    public required string PlanName { get; init; }
    public string? BillingCycle { get; init; }
    public DateTime? SubscribedOn { get; init; }
    public DateTime? RenewsOn { get; init; }
    public decimal MonthlyValue { get; init; }
    public string? PayrollStatus { get; init; }
    public DateTime? LastActivityAt { get; init; }
}

/// <summary>Overview-tab payload; kept separate so the detail call stays small.</summary>
public class CompanyOverviewResponse
{
    public required CompanyRoleBreakdownDto RoleBreakdown { get; init; }
    public required IReadOnlyList<int> AttendanceTrend14d { get; init; }
    public int AttendanceTotal14d { get; init; }
    public required CompanyAccountFactsDto AccountFacts { get; init; }
}

/// <summary>Query for the per-company employee list (Employees tab).</summary>
public class CompanyEmployeeQuery
{
    public string? Search { get; init; }

    /// <summary>HR | BranchManager | TeamLeader | Employee.</summary>
    public string? Role { get; init; }

    public int? BranchId { get; init; }

    /// <summary>Active | Invited | OnLeave | Suspended.</summary>
    public string? Status { get; init; }

    public int PageNumber { get; init; } = 1;
    public int PageSize { get; init; } = 25;
}

public class CompanyEmployeeItem
{
    public int UserId { get; init; }
    public int? EmployeeId { get; init; }
    public required string Name { get; init; }
    public required string Email { get; init; }
    public required string Initials { get; init; }

    /// <summary>HR | Branch Manager | Team Leader | Employee.</summary>
    public required string Role { get; init; }

    public int? RoleId { get; init; }
    public int? BranchId { get; init; }
    public string? BranchName { get; init; }
    public string? BranchCode { get; init; }
    public required string Status { get; init; }
    public DateTime? LastLoginAt { get; init; }
    public DateTime? JoinedOn { get; init; }
}

public class CompanyEmployeesResponse
{
    public required IReadOnlyList<CompanyEmployeeItem> Items { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages { get; init; }
}

/// <summary>Billing tab: plan card + seat meter + that company's invoices.</summary>
public class CompanyBillingResponse
{
    public required CompanyPlanCardDto Plan { get; init; }
    public required CompanySeatUsageDto Seats { get; init; }
    public required IReadOnlyList<CompanyInvoiceRow> Invoices { get; init; }
}

public class CompanyPlanCardDto
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public decimal Price { get; init; }
    public int CycleCount { get; init; }
    public required string CycleUnit { get; init; }
    public required IReadOnlyList<string> Features { get; init; }
}

public class CompanySeatUsageDto
{
    public int Used { get; init; }
    public int? Limit { get; init; }
    public int? Remaining { get; init; }
}

public class CompanyInvoiceRow
{
    public int Id { get; init; }
    public required string InvoiceNumber { get; init; }
    public required string PeriodLabel { get; init; }
    public decimal Amount { get; init; }
    public required string Status { get; init; }
    public DateTime IssuedOn { get; init; }
    public DateTime? PaidOn { get; init; }
}
