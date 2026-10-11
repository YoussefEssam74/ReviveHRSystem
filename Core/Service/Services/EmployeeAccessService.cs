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
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            if (await OwnsAsync(actorUserId, employee.Id, cancellationToken))
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

            // Team scope overrides the gym for team-scoped leaders.
            if (await teamScopeService.IsTeamScopedAsync(actorUserId, activeGymId.Value, cancellationToken))
            {
                var ledTeamId = await teamScopeService.GetLedTeamIdAsync(actorUserId, activeGymId.Value, cancellationToken);
                if (employee.TeamId != ledTeamId)
                {
                    throw new NotFoundException("Employee not found.");
                }
            }

            return employee.Id;
        }

        private async Task<bool> OwnsAsync(int actorUserId, int employeeId, CancellationToken cancellationToken)
        {
            var own = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken);
            return own is not null && own.Id == employeeId;
        }
    }
}
