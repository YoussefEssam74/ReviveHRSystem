namespace Shared.DataTransferObject.Platform;

// ------------------------------------------------------------------
// Platform audit trail — §6.10
// The console reads a richer row than the HR audit log: category, severity,
// company, review state and the actor's role.
// ------------------------------------------------------------------

public class PlatformAuditQuery
{
    /// <summary>critical | warning | info.</summary>
    public string? Severity { get; init; }

    /// <summary>Company id; "platform" selects company-less rows only.</summary>
    public string? CompanyId { get; init; }

    /// <summary>Access | Billing | Gym | User | Settings | Security | Payroll | Data | Recruitment | Attendance.</summary>
    public string? Category { get; init; }

    public string? Action { get; init; }
    public int? ActorId { get; init; }
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }

    /// <summary>Case-insensitive match across action, actor, target and IP.</summary>
    public string? Search { get; init; }

    public int PageNumber { get; init; } = 1;
    public int PageSize { get; init; } = 25;
}

public class PlatformAuditActor
{
    public int? UserId { get; init; }
    public required string Name { get; init; }
    public required string Initials { get; init; }
    public string? Role { get; init; }
    public string? IpAddress { get; init; }
}

public class PlatformAuditCompanyRef
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public string? City { get; init; }
}

public class PlatformAuditItem
{
    public int Id { get; init; }
    public DateTime OccurredAt { get; init; }
    public required PlatformAuditActor Actor { get; init; }
    public PlatformAuditCompanyRef? Company { get; init; }
    public string? Category { get; init; }
    public string? Severity { get; init; }

    /// <summary>Human-readable label; falls back to Action when no label was recorded.</summary>
    public required string Action { get; init; }

    public string? Target { get; init; }
    public string? IpAddress { get; init; }
    public bool Reviewed { get; init; }
}

public class PlatformAuditCounts
{
    public int Total { get; init; }
    public int Critical { get; init; }
    public int Warning { get; init; }
    public int Info { get; init; }
    public int AwaitingReview { get; init; }
}

public class PlatformAuditListResponse
{
    public required IReadOnlyList<PlatformAuditItem> Items { get; init; }
    public required PlatformAuditCounts Counts { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages { get; init; }
}

/// <summary>Event detail dialog — adds the free-text explanation and before/after payloads.</summary>
public class PlatformAuditDetailResponse
{
    public int Id { get; init; }
    public DateTime OccurredAt { get; init; }
    public required PlatformAuditActor Actor { get; init; }
    public PlatformAuditCompanyRef? Company { get; init; }
    public int? BranchId { get; init; }
    public string? Category { get; init; }
    public string? Severity { get; init; }
    public required string Action { get; init; }
    public string? Target { get; init; }
    public string? Detail { get; init; }
    public string? OldValues { get; init; }
    public string? NewValues { get; init; }
    public bool Reviewed { get; init; }
    public DateTime? ReviewedAt { get; init; }
    public PlatformAuditActor? ReviewedBy { get; init; }

    /// <summary>Always true — audit rows are append-only, including for a Super Admin.</summary>
    public bool Immutable { get; init; } = true;
}

public class ReviewAuditEventRequest
{
    public string? Note { get; init; }
}

public class ReviewAuditEventResponse
{
    public int Id { get; init; }
    public bool Reviewed { get; init; }
    public DateTime ReviewedAt { get; init; }
    public required PlatformAuditActor ReviewedBy { get; init; }
}
