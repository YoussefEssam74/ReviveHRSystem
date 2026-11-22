namespace Shared.DataTransferObject.Platform;

// ------------------------------------------------------------------
// Platform-wide audit trail — §6.10
// The platform trail reuses PlatformAuditQuery (whose CompanyId already
// accepts an id or "platform") and PlatformAuditItem from PlatformAuditDtos.
// ------------------------------------------------------------------

public class PlatformAuditSummaryResponse
{
    public int AwaitingReview { get; init; }
    public int CriticalTotal { get; init; }
    public int ImpersonationSessions { get; init; }
    public int FailedSignIns { get; init; }
    public int DataExports { get; init; }
    public int TotalEvents { get; init; }
    public DateTime? OldestUnreviewedAt { get; init; }
}

public class PlatformAuditReviewQueueResponse
{
    public required IReadOnlyList<PlatformAuditItem> Items { get; init; }
    public int Total { get; init; }
}

// ------------------------------------------------------------------
// Audit retention policy — §6.10
// ------------------------------------------------------------------

public class AuditRetentionPolicyDto
{
    public int PlatformEventsYears { get; init; }
    public int CompanyEventsYears { get; init; }
    public int ImpersonationYears { get; init; }
    public int ExportRetentionDays { get; init; }

    /// <summary>Always false — the trail is append-only, including for a Super Admin.</summary>
    public bool Deletable { get; init; }

    public DateTime? UpdatedAt { get; init; }
}

public class UpdateAuditRetentionPolicyRequest
{
    public int PlatformEventsYears { get; init; }
    public int CompanyEventsYears { get; init; }
    public int ImpersonationYears { get; init; }
    public int ExportRetentionDays { get; init; }
}

// ------------------------------------------------------------------
// Impersonation session ledger — §6.10 / §6.12
// ------------------------------------------------------------------

public class ImpersonationSessionRow
{
    public int SessionId { get; init; }
    public int ActorUserId { get; init; }
    public required string ActorName { get; init; }
    public int CompanyId { get; init; }
    public required string CompanyName { get; init; }
    public string? BranchName { get; init; }
    public string? EffectiveRole { get; init; }
    public DateTime StartedAt { get; init; }
    public DateTime? EndedAt { get; init; }
    public int? DurationMinutes { get; init; }
    public string? IpAddress { get; init; }
    public string? Reason { get; init; }
}

public class ImpersonationSessionsResponse
{
    public required IReadOnlyList<ImpersonationSessionRow> Items { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages { get; init; }
}

public class ImpersonationSessionsQuery
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public int? ActorId { get; init; }
    public int PageNumber { get; init; } = 1;
    public int PageSize { get; init; } = 25;
}

// ------------------------------------------------------------------
// Audit export — §6.10
// ------------------------------------------------------------------

public class CreateAuditExportRequest
{
    /// <summary>Csv (default) | Json.</summary>
    public string? Format { get; init; }

    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public string? Severity { get; init; }
    public int? CompanyId { get; init; }
    public string? Category { get; init; }
}

public class CreateAuditExportResponse
{
    public required string ExportId { get; init; }
    public required string Status { get; init; }
    public required string Format { get; init; }
    public int EstimatedRows { get; init; }
    public DateTime ExpiresAt { get; init; }
}

public class AuditExportStatusResponse
{
    public required string ExportId { get; init; }
    public required string Status { get; init; }
    public string? DownloadUrl { get; init; }
    public DateTime ExpiresAt { get; init; }
}
