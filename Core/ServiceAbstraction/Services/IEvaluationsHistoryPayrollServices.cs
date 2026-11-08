using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.Payroll;

namespace ServiceAbstraction.Services
{
    /// <summary>Own evaluations (mock §9 My Evaluations), primarily read-only.</summary>
    public interface IEvaluationSelfService
    {
        Task<IReadOnlyList<EvaluationDto>> GetEvaluationsAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Evaluation authoring for managers (mock 14.6/14.7/18.1): the forms a leader may
    /// fill in, submitting a response for an in-scope employee, editing one, and the
    /// team's evaluation history. Score is the mean of the numeric answers.
    /// </summary>
    public interface IEvaluationManagementService
    {
        /// <summary>Active forms available in the active gym (or global).</summary>
        Task<IReadOnlyList<EvaluationFormDto>> GetFormsAsync(
            int actorUserId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>Submits an evaluation of an in-scope employee.</summary>
        Task<EvaluationDto> CreateAsync(
            int actorUserId, int employeeId, int? activeGymId, CreateEvaluationResponseDto request,
            CancellationToken cancellationToken = default);

        /// <summary>Edits the answers of an in-scope evaluation.</summary>
        Task<EvaluationDto> UpdateAsync(
            int actorUserId, int employeeId, int evaluationId, int? activeGymId, UpdateEvaluationDto request, CancellationToken cancellationToken = default);

        /// <summary>Evaluations of the caller's team members (mock 18.1 Team Performance).</summary>
        Task<IReadOnlyList<EvaluationDto>> GetTeamEvaluationsAsync(
            int actorUserId, int? activeGymId, int? teamId, CancellationToken cancellationToken = default);
    }

    /// <summary>Employment history timeline (mock §5), read-only.</summary>
    public interface IEmploymentHistoryService
    {
        Task<IReadOnlyList<EmploymentHistoryMonthDto>> GetHistoryAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);
    }

    /// <summary>Employee-facing events and announcements (mock §4 Events).</summary>
    public interface IEmployeeEventService
    {
        Task<IReadOnlyList<EmployeeEventDto>> GetEventsAsync(
            int userId, int? activeGymId, int? employeeId, CancellationToken cancellationToken = default);
    }

    /// <summary>Own payroll periods and payslip contents (mock §8 My Payroll).</summary>
    public interface IPayrollSelfService
    {
        Task<IReadOnlyList<PayrollEntryDto>> GetPayrollAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>One sheet's payslip card (mock §8 modal) for the employee's own sheet.</summary>
        Task<PayslipResponse> GetPayslipAsync(
            int actorUserId, int employeeId, int entryId, CancellationToken cancellationToken = default);
    }
}
