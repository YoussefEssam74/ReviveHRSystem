namespace ServiceAbstraction.Services
{
    /// <summary>
    /// The attendance → deduction bridge: for a window of days it turns every
    /// unexcused absence (stored record or derived scheduled-but-unpunched day) and
    /// every late arrival into a priced, pending <c>DeductionCandidate</c> the branch
    /// can see and decide on in the Employees Performance deductions tab — and takes
    /// back the ones the day no longer justifies (a corrected record, an approved
    /// day off). Idempotent per (employee, day): re-running the sweep never
    /// duplicates or re-prices an existing deduction.
    /// </summary>
    public interface IAttendanceDeductionSweepService
    {
        /// <summary>
        /// Sweeps <paramref name="employeeIds"/> over <paramref name="from"/>…
        /// <paramref name="to"/> (clamped to the gym's local today) and returns how
        /// many deductions were raised.
        /// </summary>
        Task<int> SweepAsync(
            IReadOnlyCollection<int> employeeIds, DateOnly from, DateOnly to, CancellationToken cancellationToken = default);
    }
}
