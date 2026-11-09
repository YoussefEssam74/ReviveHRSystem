using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Employee dashboard (mock §1): today's shift and attendance, upcoming published
    /// schedule, pending requests, latest payroll, recent notifications, required
    /// actions, and the role-scoped overview strip (team for Team Leaders, gym for
    /// Branch Managers). Purely an aggregate over the self-service reads.
    /// </summary>
    public interface IDashboardService
    {
        /// <summary>
        /// Builds the dashboard. <paramref name="activeGymId"/> is the gym the access
        /// token is scoped to (the session context); it drives the overview scope, with
        /// the employee's primary gym as the fallback for unscoped sessions.
        /// </summary>
        Task<EmployeeDashboardDto> GetDashboardAsync(int userId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>
        /// HR portal dashboard (mock §1 HR): KPI strip (gyms/staff/pending
        /// requests/actions), the Actions Needed decision cards (permission-gated
        /// per card) and the per-gym branches oversight, all within the actor's
        /// gym scope.
        /// </summary>
        Task<HrDashboardDto> GetHrDashboardAsync(int userId, int? activeGymId, CancellationToken cancellationToken = default);
    }
}
