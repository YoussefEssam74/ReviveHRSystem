namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A deduction candidate awaiting HR review (mock §20 Issue Deduction).</summary>
public sealed class DeductionCandidateDto
{
    public int Id { get; init; }
    public int EmployeeId { get; init; }
    public string Employee { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public decimal DeductionDays { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string? Note { get; init; }
    public string Status { get; init; } = string.Empty;
    /// <summary>The day the deduction punishes: its attendance day, else the day it was issued.</summary>
    public DateOnly Date { get; init; }
    public DateTime IssuedAt { get; init; }
    public string IssuedBy { get; init; } = string.Empty;
}

public sealed class CreateDeductionCandidateDto
{
    public int EmployeeId { get; init; }

    /// <summary>The day the deduction punishes (defaults to today when omitted).</summary>
    public DateOnly? Date { get; init; }

    public decimal Amount { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string? Note { get; init; }
}

/// <summary>The branch's own decision on a deduction before HR applies it to payroll (mock §20).</summary>
/// <param name="Decision"><c>approve</c> (branch approves), <c>reject</c> (final) or <c>edit</c> (amount re-price).</param>
/// <param name="Amount">
/// Optional revised amount — applied with the decision (approve/edit). Required for
/// <c>edit</c>; must be positive.
/// </param>
public sealed record BranchDeductionReviewRequest(string Decision, decimal? Amount = null, decimal? Days = null);

/// <summary>A warning notice awaiting HR filing (mock §20 Issue Warning Notice).</summary>
public sealed class WarningNoticeDto
{
    public int Id { get; init; }
    public int EmployeeId { get; init; }
    public string Employee { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Reason { get; init; } = string.Empty;
    public string? Note { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTime IssuedAt { get; init; }
    public string IssuedBy { get; init; } = string.Empty;
    /// <summary>HR reviewer's display name once decided.</summary>
    public string? ReviewedBy { get; init; }
    public DateTime? ReviewedAt { get; init; }
    /// <summary>HR's reason when declined.</summary>
    public string? ReviewNote { get; init; }
}

public sealed class CreateWarningNoticeDto
{
    public int EmployeeId { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Reason { get; init; } = string.Empty;
    public string? Note { get; init; }
}

/// <summary>A bonus proposal awaiting HR approval (mock §20 Propose Bonus).</summary>
public sealed class BonusProposalDto
{
    public int Id { get; init; }
    public int EmployeeId { get; init; }
    public string Employee { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string? Note { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTime IssuedAt { get; init; }
    public string IssuedBy { get; init; } = string.Empty;
    /// <summary>HR reviewer's display name once decided.</summary>
    public string? ReviewedBy { get; init; }
    public DateTime? ReviewedAt { get; init; }
    /// <summary>HR's reason when declined.</summary>
    public string? ReviewNote { get; init; }
}

public sealed class CreateBonusProposalDto
{
    public int EmployeeId { get; init; }
    public string Type { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string? Note { get; init; }
}

/// <summary>An item in the manager's "Awaiting HR" queue (mock §20 palette).</summary>
public sealed class BranchQueueItemDto
{
    public int Id { get; init; }
    public string Kind { get; init; } = string.Empty;
    public string Employee { get; init; } = string.Empty;
    public string Detail { get; init; } = string.Empty;
    public DateTime Date { get; init; }
    public string Status { get; init; } = string.Empty;
}

/// <summary>A free-form report sent from a branch to HR (mock §20 Send Report to HR).</summary>
public sealed class CreateBranchReportDto
{
    public string Period { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
}

// ------------------------------------------------------------------
// HR review endpoints for branch-raised warnings & bonuses
// ------------------------------------------------------------------

/// <summary>Query for the HR warning-notice / bonus-proposal lists: status + gym + pager.</summary>
public sealed class ProposalListQuery
{
    /// <summary>Pending | Approved | Rejected | blank (all).</summary>
    public string? Status { get; init; }
    /// <summary>Gym id or branch name; blank = actor's full scope.</summary>
    public string? Gym { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

/// <summary>Paged envelope shared by the warning-notice and bonus-proposal lists.</summary>
public sealed class ProposalListResponse<T> where T : class
{
    public required IReadOnlyList<T> Items { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int Total { get; init; }
    public int TotalPages { get; init; }
}

/// <summary>POST /api/warning-notices/{id}/review and /api/bonus-proposals/{id}/review body.</summary>
public sealed class ReviewProposalRequest
{
    /// <summary>Approved (file/approve) | Rejected (decline).</summary>
    public string? Decision { get; init; }
    /// <summary>Reason — required when rejecting, optional when approving.</summary>
    public string? Note { get; init; }
}

/// <summary>Review → the updated proposal, echoed as { data }.</summary>
public sealed class ReviewProposalResponse<T> where T : class
{
    public required T Data { get; init; }
}
