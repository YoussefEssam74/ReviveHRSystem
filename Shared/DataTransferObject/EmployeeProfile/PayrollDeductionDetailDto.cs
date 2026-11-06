namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>
/// One detail row behind a Monthly Breakdown's deductions section (mock §8): every
/// late / absent day of the period with its facts (minutes late, check-in time) and
/// every branch-raised deduction with its reason, issuer and review status.
/// </summary>
/// <param name="Kind">
/// <c>late</c> — an informational row per late check-in; <c>absent</c> — per absent
/// day (with the deduction trail when one is attached); <c>candidate</c> — a
/// supervisor-raised deduction that matches no attendance day.
/// </param>
/// <param name="Date">The attendance day, or the issue day for unmatched candidates.</param>
/// <param name="Label">Row title ("Late arrival" / the candidate reason).</param>
/// <param name="Amount">Positive amount of an attached deduction — null when informational.</param>
/// <param name="MinutesLate">
/// How many minutes after shift start the check-in landed — late rows only; based on
/// the gym-local check-in time so delay and shift start share one clock.
/// </param>
/// <param name="CheckInAt">Gym-local HH:mm check-in — late rows only.</param>
/// <param name="Shift">The day's scheduled shift window ("Morning Shift 08:00–16:00") — late/absent rows.</param>
/// <param name="Reason">The attached deduction's note / follow-up description; null when none.</param>
/// <param name="IssuedBy">Username of the manager who issued the attached deduction.</param>
/// <param name="Status">Human review status of the attached deduction (In review / Branch approved / ...).</param>
public sealed record PayrollDeductionDetailDto
{
    public string Kind { get; init; } = "candidate";
    public DateOnly Date { get; init; }
    public string Label { get; init; } = string.Empty;
    public decimal? Amount { get; init; }
    public int? MinutesLate { get; init; }
    public string? CheckInAt { get; init; }
    public string? Shift { get; init; }
    public string? Reason { get; init; }
    public string? IssuedBy { get; init; }
    public string? Status { get; init; }

    /// <summary>
    /// The attendance day this row prices — pairs the row with its payroll line so the
    /// sheet can merge them into one per-day deduction instead of showing the money twice.
    /// </summary>
    public int? AttendanceRecordId { get; init; }
}
