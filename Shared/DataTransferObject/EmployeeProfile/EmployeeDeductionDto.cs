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
    /// <param name="Amount">Money deductions (candidates) carry an amount; day-based follow-ups don't.</param>
    /// <param name="Status">Human status: In review / Resolved / Applied / Rejected.</param>
    /// <param name="Detail">Extra line — the follow-up's last action or the candidate's note.</param>
    /// <param name="CorrectionRequestId">His correction request for this date, when one exists.</param>
    /// <param name="CorrectionStatus">Raw status of that request (Pending, PendingHRReview, ...).</param>
    public record EmployeeDeductionDto(
        string Id,
        string Source,
        DateOnly? Date,
        string Description,
        decimal? Amount,
        string Status,
        string? Detail,
        int? CorrectionRequestId,
        string? CorrectionStatus);
}
