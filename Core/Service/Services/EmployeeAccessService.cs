using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;

namespace Service.Services
{
    /// <summary>
    /// Scope guard for employee-scoped endpoints (ADR-003 Amendment 1):
    ///   self → always;
    ///   others → feature level in the active gym + resolved scope
    ///     (Team Leader ⇒ member of his team in that gym; Branch Manager ⇒ the gym).
    /// Failures surface as NotFound so the API never confirms another gym's data exists.
    /// </summary>
    public class EmployeeAccessService(
        IUnitOfWork unitOfWork,
        IPermissionService permissionService,
        ITeamScopeService teamScopeService) : IEmployeeAccessService
    {
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
            int actorUserId, int employeeId, string feature, AccessLevel requiredLevel,
            int? activeGymId, CancellationToken cancellationToken = default)
        {
            // Sequential: a scoped DbContext serves these, and EF Core does not allow
            // two concurrent operations on one context — parallelising these lookups
            // throws InvalidOperationException once the model grows past the point
            // where the round-trips happened to serialise themselves.
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            var own = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken);

            // Self-access: the actor is the target employee — no further checks needed.
            if (own is not null && own.Id == employee.Id)
            {
                return employee.Id;
            }

            if (!activeGymId.HasValue)
            {
                throw new NotFoundException("Employee not found.");
            }

            var hasLevel = await permissionService.HasAccessAsync(
                actorUserId, activeGymId.Value, feature, requiredLevel, cancellationToken);
            if (!hasLevel)
            {
                throw new NotFoundException("Employee not found.");
            }

            // Gym scope: the employee must belong to the active gym.
            if (employee.GymId != activeGymId.Value)
            {
                throw new NotFoundException("Employee not found.");
            }

            // Team scope comes from the per-gym role: a team-scoped actor sees only the
            // team he leads, and one without a matching team is denied - never gym-wide.
            if (await teamScopeService.IsTeamScopedAsync(actorUserId, activeGymId.Value, cancellationToken))
            {
                var ledTeamId = await teamScopeService.GetLedTeamIdAsync(actorUserId, activeGymId.Value, cancellationToken);
                if (ledTeamId is null || employee.TeamId != ledTeamId.Value)
                {
                    throw new NotFoundException("Employee not found.");
                }
            }

            return employee.Id;
        }
    }
}
