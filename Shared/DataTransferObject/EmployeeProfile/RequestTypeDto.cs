namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>
/// A configurable request type offered by the form (mock requestTypes). The rule flags
/// mirror the service-side validation so the client renders the right fields, blocks
/// impossible submissions, and knows which types carry limits.
/// </summary>
public sealed class RequestTypeDto
{
    public string Id { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public IReadOnlyList<string> Fields { get; init; } = Array.Empty<string>();

    /// <summary>Leave balance the request draws from ("Annual" | "Sick"), or null.</summary>
    public string? ConsumesLeave { get; init; }

    /// <summary>A file (e.g. the medical certificate for Sick Leave) must ride with the request.</summary>
    public bool RequiresAttachment { get; init; }

    /// <summary>A colleague to swap with must be named (shift swaps).</summary>
    public bool RequiresColleague { get; init; }

    /// <summary>A positive amount must be supplied (salary advance).</summary>
    public bool RequiresAmount { get; init; }

    /// <summary>Counted against the gym's monthly excused-hours cap (late attendance / early leave).</summary>
    public bool LimitedByMonthlyExcusedHours { get; init; }

    /// <summary>A second date must be supplied (the off day taken in exchange for a weekly off swap).</summary>
    public bool RequiresTargetDate { get; init; }
}
