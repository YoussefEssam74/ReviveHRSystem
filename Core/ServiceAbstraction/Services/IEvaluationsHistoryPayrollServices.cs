using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>Own evaluations (mock §9 My Evaluations), primarily read-only.</summary>
    public interface IEvaluationSelfService
    {
        Task<IReadOnlyList<EvaluationDto>> GetEvaluationsAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);
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
    }
}
