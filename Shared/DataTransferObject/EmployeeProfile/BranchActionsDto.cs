namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A deduction candidate awaiting HR review (mock §20 Issue Deduction).</summary>
public sealed class DeductionCandidateDto
{
    public int Id { get; init; }
    public int EmployeeId { get; init; }
    public string Employee { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string? Note { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTime IssuedAt { get; init; }
    public string IssuedBy { get; init; } = string.Empty;
}

public sealed class CreateDeductionCandidateDto
{
    public int EmployeeId { get; init; }
    public decimal Amount { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string? Note { get; init; }
}

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
