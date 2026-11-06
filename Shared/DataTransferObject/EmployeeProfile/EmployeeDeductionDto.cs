namespace Shared.DataTransferObject.EmployeeProfile
{
    /// <summary>
    /// One deduction hanging on an employee as he sees it: an absence follow-up raised
    /// by the sweep (or a manager) or a payroll deduction candidate issued for him —
    /// joined with the Deduction Correction request he filed against the same date, so
    /// the card can show the whole trail in a single row.
    /// </summary>
    /// <param name="Id">
    /// Scoped string id — follow-ups and candidates have separate integer id spaces,
    /// so the two sources are prefixed instead of colliding.
    /// </param>
    /// <param name="Source"><c>absence</c> (follow-up) or <c>candidate</c> (payroll).</param>
    /// <param name="Date">
    /// Absence day parsed from the sweep's note marker; null for manually raised
    /// follow-ups that never carried one. Candidates fall back to their issue date.
    /// </param>
    /// <param name="Description">What the deduction is for ("Deduction — 3 Days" / the reason).</param>
    /// <param name="Amount">
    /// Candidates carry their money amount; follow-ups price their described
    /// day-multiple against the sheet's daily rate (null without a priced sheet).
    /// </param>
    /// <param name="Status">Human status: In review / Resolved / Applied / Rejected.</param>
    /// <param name="Detail">Extra line — the follow-up's last action or the candidate's note.</param>
    /// <param name="CorrectionRequestId">His correction request for this date, when one exists.</param>
    /// <param name="CorrectionStatus">Raw status of that request (Pending, PendingHRReview, ...).</param>
    /// <param name="IssuedBy">Username of the manager who raised it; null when the system sweep did.</param>
    /// <param name="AttendanceDate">
    /// The attendance day the candidate targets (from its linked AttendanceRecord) —
    /// the issue date alone can lag the absence it punishes.
    /// </param>
    public record EmployeeDeductionDto(
        string Id,
        string Source,
        DateOnly? Date,
        string Description,
        decimal? Amount,
        string Status,
        string? Detail,
        int? CorrectionRequestId,
        string? CorrectionStatus,
        string? IssuedBy = null,
        DateOnly? AttendanceDate = null);
}
