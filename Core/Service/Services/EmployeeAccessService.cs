using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using Service.Specifications;
using ServiceAbstraction.Services;

namespace Service.Services
{
    /// <summary>
    /// Scope guard for employee-scoped endpoints:
    ///   self → always;
    ///   others → the target's gym membership plus an acting role in that gym:
    ///     a team-scoped Team Leader sees only his team, while Branch Manager,
    ///     HR, HR Manager and Super Admin cover the gym. A plain employee (the
    ///     Employee role) never reaches another employee's file — these routes
    ///     are self-service for him.
    /// Failures surface as NotFound so the API never confirms another gym's data exists.
    /// </summary>
    public class EmployeeAccessService(
        IUnitOfWork unitOfWork,
        ITeamScopeService teamScopeService,
        IUserAccessRepository userAccess) : IEmployeeAccessService
    {
        private static readonly string[] ManagerRoleNames =
        [
            Shared.Authorization.RoleNames.TeamLeader,
            Shared.Authorization.RoleNames.BranchManager,
            Shared.Authorization.RoleNames.Hr,
            Shared.Authorization.RoleNames.HrManager,
            Shared.Authorization.RoleNames.SuperAdmin,
        ];

        public async Task<int?> GetOwnEmployeeIdAsync(int actorUserId, CancellationToken cancellationToken = default)
        {
            var user = await unitOfWork.GetRepository<DomainLayer.Models.UserModule.User, int>()
                .GetByIdAsync(new UserByIdSpec(actorUserId), cancellationToken);
            if (user is null)
            {
                return null;
            }

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken);
            return employee?.Id;
        }

        public async Task<int> EnsureCanAccessAsync(
            int actorUserId, int employeeId,
            int? activeGymId, CancellationToken cancellationToken = default)
        {
            // Sequential: a scoped DbContext serves these, and EF Core does not allow
            // two concurrent operations on one context — parallelising these lookups
            // throws InvalidOperationException once the model grows past the point
            // where the round-trips happened to serialise themselves.
            var employee = await LoadTargetAsync(employeeId, cancellationToken);

            var own = await LoadOwnAsync(actorUserId, cancellationToken);

            // Self-access: the actor is the target employee — no further checks needed.
            if (own is not null && own.Id == employee.Id)
            {
                return employee.Id;
            }

            if (!activeGymId.HasValue)
            {
                throw new NotFoundException("Employee not found.");
            }

            await EnsureGymScopeAsync(actorUserId, employee, activeGymId.Value, cancellationToken);
            return employee.Id;
        }

        /// <summary>
        /// Same guard, but an unscoped session resolves its scope from the employee's own
        /// gym. HR Manager and Top Management accounts cover several gyms, so their token
        /// carries no single active gym; a strict <c>null</c>-gym refusal (which other
        /// endpoints use to mean "self-only") locked them out of every employee outside
        /// their own record — the sick-leave certificate among them. Covering the
        /// employee's gym is still required, and the per-gym team/role checks then run
        /// against it exactly as they do for a scoped session.
        /// </summary>
        public async Task<int> EnsureCanAccessCoveredGymAsync(
            int actorUserId, int employeeId,
            int? activeGymId, CancellationToken cancellationToken = default)
        {
            var employee = await LoadTargetAsync(employeeId, cancellationToken);

            var own = await LoadOwnAsync(actorUserId, cancellationToken);
            if (own is not null && own.Id == employee.Id)
            {
                return employee.Id;
            }

            if (!activeGymId.HasValue)
            {
                if (!await userAccess.HasGymAccessAsync(actorUserId, employee.GymId, cancellationToken))
                {
                    throw new NotFoundException("Employee not found.");
                }

                activeGymId = employee.GymId;
            }

            await EnsureGymScopeAsync(actorUserId, employee, activeGymId.Value, cancellationToken);
            return employee.Id;
        }

        private async Task<Employee> LoadTargetAsync(int employeeId, CancellationToken cancellationToken) =>
            await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
            ?? throw new NotFoundException("Employee not found.");

        private async Task<Employee?> LoadOwnAsync(int actorUserId, CancellationToken cancellationToken) =>
            await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken);

        private async Task EnsureGymScopeAsync(
            int actorUserId, Employee employee, int activeGymId, CancellationToken cancellationToken)
        {
            // Gym scope: the employee must belong to the scoped gym.
            if (employee.GymId != activeGymId)
            {
                throw new NotFoundException("Employee not found.");
            }

            // Team scope comes from the per-gym role: a team-scoped actor sees only the
            // team he leads, and one without a matching team is denied - never gym-wide.
            if (await teamScopeService.IsTeamScopedAsync(actorUserId, activeGymId, cancellationToken))
            {
                var ledTeamId = await teamScopeService.GetLedTeamIdAsync(actorUserId, activeGymId, cancellationToken);
                if (ledTeamId is null || employee.TeamId != ledTeamId.Value)
                {
                    throw new NotFoundException("Employee not found.");
                }

                return;
            }

            // Acting-manager check for every other caller: without a management role
            // in this (already matching) gym the employee's file does not exist for
            // the query — a plain employee may only read his own record.
            var roleNames = await userAccess.GetGymRoleNamesAsync(actorUserId, activeGymId, cancellationToken);
            if (!roleNames.Any(ManagerRoleNames.Contains))
            {
                throw new NotFoundException("Employee not found.");
            }
        }
    }
}
