namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>
/// Create-request body (mock openNewRequest / submitNewRequest). Which fields matter
/// is decided by the request type: date ranges (annual / sick / shift swap), a date +
/// time (late attendance, early leave, check-in correction), a colleague (both swaps),
/// a target date (weekly off swap) or an amount (salary advance).
/// </summary>
public sealed class CreateEmployeeRequestDto
{
    public string Type { get; init; } = string.Empty;

    /// <summary>Primary date of the request: the leave range start, the incident date,
    /// the shift day, the off day given up (weekly off swap) or the paid holiday worked.</summary>
    public DateOnly RequestDate { get; init; }

    /// <summary>Last day of a leave range or a shift swap window; defaults to the request date.</summary>
    public DateOnly? EndDate { get; init; }

    /// <summary>The off day taken in exchange for the weekly off given up (weekly off swap only).</summary>
    public DateOnly? TargetDate { get; init; }

    /// <summary>The actual arrival time (late attendance), the departure time (early leave)
    /// or the corrected check-in time (check-in correction).</summary>
    public TimeOnly? RequestTime { get; init; }

    /// <summary>Colleague named by a shift swap / weekly off swap.</summary>
    public int? SwapWithEmployeeId { get; init; }

    /// <summary>Amount asked for by a salary advance request.</summary>
    public decimal? Amount { get; init; }

    public string Reason { get; init; } = string.Empty;
}

/// <summary>A swap candidate for the request form (id + display name only — PII-light).</summary>
public sealed class EmployeeColleagueDto
{
    public int Id { get; init; }
    public string FullName { get; init; } = string.Empty;
}

/// <summary>
/// A file riding with a request (the sick-leave medical certificate). The stream is
/// handed to storage exactly as the avatar upload does; only the relative path is kept.
/// </summary>
public sealed record AttachmentUpload(string FileName, Stream Content);
