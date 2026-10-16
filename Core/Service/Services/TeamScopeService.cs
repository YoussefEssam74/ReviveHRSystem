using DomainLayer.Contracts;
using DomainLayer.Models.OrganizationModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;

namespace Service.Services
{
    /// <summary>
    /// Resolves the management scope of a user in one gym (ADR-003 Amendment 1).
    /// Scope comes from the per-gym role: the Team Leader role ⇒ team scope (the
    /// leader's TeamLeaders row in that gym); every other role (Branch Manager, HR,
    /// HR Manager, plain Employee) ⇒ no team limitation here. Individual feature
    /// levels never widen the scope.
    /// </summary>
    public class TeamScopeService(IUnitOfWork unitOfWork, IUserAccessRepository userAccess) : ITeamScopeService
    {
        public async Task<int?> GetLedTeamIdAsync(int userId, int gymId, CancellationToken cancellationToken = default)
        {
            var teamLeaders = await unitOfWork.GetRepository<TeamLeader, int>()
                .GetAllAsync(new TeamLeaderByUserAndGymSpec(userId, gymId), cancellationToken);

            return teamLeaders.Select(tl => (int?)tl.TeamId).FirstOrDefault();
        }

        public async Task<bool> IsTeamScopedAsync(int userId, int gymId, CancellationToken cancellationToken = default)
        {
            var roleNames = await userAccess.GetGymRoleNamesAsync(userId, gymId, cancellationToken);
            if (!roleNames.Contains(RoleNames.TeamLeader, StringComparer.Ordinal))
            {
                return false;
            }

            return await GetLedTeamIdAsync(userId, gymId, cancellationToken) is not null;
        }
    }
}
