using Shared.DataTransferObject.Payroll;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Payroll page (api-spec-from-ui.md §5.5): period directory + detail with entry
    /// sheets, the settlement actions (bonus edit, add line, close/reopen, line review),
    /// publish &amp; lock, the pending-deduction review queue, payslips, the CSV export,
    /// per-employee payroll history, and the punch-audit lookup behind attendance refs.
    /// Periods are per-gym rows (ADR-003) — reads resolve the actor's scope, writes
    /// enforce access to the period's gym.
    /// </summary>
    public interface IPayrollService
    {
        /// <summary>Paged period directory with totals (payroll.view).</summary>
        Task<PayrollPeriodListResponse> GetPeriodsAsync(int? actorUserId, PayrollPeriodListQuery query, CancellationToken cancellationToken = default);

        /// <summary>One period with its entry sheets (payroll.view).</summary>
        Task<PayrollPeriodDetailResponse> GetPeriodAsync(int? actorUserId, int periodId, int? gym, CancellationToken cancellationToken = default);

        /// <summary>Sets an entry's bonus and echoes the recomputed totals (payroll.edit).</summary>
        Task<EntryTotalsResponse> UpdateBonusAsync(int? actorUserId, int periodId, int employeeId, UpdateBonusRequest request, CancellationToken cancellationToken = default);

        /// <summary>Adds a Pending deduction line to an open period (payroll.edit) → 201.</summary>
        Task<CreateDeductionResponse> AddDeductionAsync(int? actorUserId, int periodId, int employeeId, CreateDeductionRequest request, CancellationToken cancellationToken = default);

        /// <summary>Closes &amp; settles one sheet — refuses while lines are pending (payroll.edit).</summary>
        Task<CloseEntryResponse> CloseEntryAsync(int? actorUserId, int periodId, int employeeId, CancellationToken cancellationToken = default);

        /// <summary>Reopens a settled sheet back to Draft (payroll.edit).</summary>
        Task<ReopenEntryResponse> ReopenEntryAsync(int? actorUserId, int periodId, int employeeId, CancellationToken cancellationToken = default);

        /// <summary>Publishes &amp; locks the branch once every sheet is settled (payroll.approve).</summary>
        Task<ApprovePeriodResponse> ApprovePeriodAsync(int? actorUserId, int periodId, ApprovePeriodRequest request, CancellationToken cancellationToken = default);

        /// <summary>Pending deduction lines across periods (payroll.view or payroll.edit).</summary>
        Task<DeductionCandidateListResponse> GetDeductionCandidatesAsync(int? actorUserId, DeductionCandidateListQuery query, CancellationToken cancellationToken = default);

        /// <summary>Accepts / rejects one deduction line (payroll.edit).</summary>
        Task<ReviewDeductionResponse> ReviewDeductionAsync(int? actorUserId, int lineId, ReviewDeductionRequest request, CancellationToken cancellationToken = default);

        /// <summary>Payslip preview for one sheet (payroll.view).</summary>
        Task<PayslipResponse> GetPayslipAsync(int? actorUserId, int periodId, int employeeId, CancellationToken cancellationToken = default);

        /// <summary>Period export as a CSV stream (payroll.export).</summary>
        Task<(string FileName, byte[] Content)> ExportPeriodAsync(int? actorUserId, int periodId, int? gym, string? format, CancellationToken cancellationToken = default);

        /// <summary>One employee's payroll history across periods (payroll.view).</summary>
        Task<EmployeePayrollResponse> GetEmployeePayrollAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default);

        /// <summary>Punch audit for an "ATT-{id}" reference (payroll.view or attendance.view).</summary>
        Task<AttendanceRefResponse> GetAttendanceRefAsync(int? actorUserId, string id, CancellationToken cancellationToken = default);
    }
}
