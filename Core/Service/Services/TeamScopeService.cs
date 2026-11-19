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
        private static readonly string[] GymWideRoleNames =
        [
            RoleNames.SuperAdmin,
            RoleNames.Hr,
            RoleNames.HrManager,
        ];

        public async Task<int?> GetLedTeamIdAsync(int userId, int gymId, CancellationToken cancellationToken = default)
        {
            var teamLeaders = await unitOfWork.GetRepository<TeamLeader, int>()
                .GetAllAsync(new TeamLeaderByUserAndGymSpec(userId, gymId), cancellationToken);

            return teamLeaders.Select(tl => (int?)tl.TeamId).FirstOrDefault();
        }

        public async Task<IReadOnlyList<int>> GetLedTeamIdsAsync(int userId, int gymId, CancellationToken cancellationToken = default)
        {
            var teamLeaders = await unitOfWork.GetRepository<TeamLeader, int>()
                .GetAllAsync(new TeamLeaderByUserAndGymSpec(userId, gymId), cancellationToken);

            return teamLeaders.Select(tl => tl.TeamId).Distinct().ToList();
        }

        public async Task<bool> IsTeamScopedAsync(int userId, int gymId, CancellationToken cancellationToken = default)
        {
            var roleNames = await userAccess.GetGymRoleNamesAsync(userId, gymId, cancellationToken);

            // A gym-wide role always wins: a promoted Branch Manager who still has a
            // stale TeamLeaders row keeps gym scope.
            if (roleNames.Any(GymWideRoleNames.Contains))
            {
                return false;
            }

            // Team Leader without a TeamLeaders row is team-scoped with no team, so the
            // caller denies — it must never fall through to gym-wide access.
            return roleNames.Contains(RoleNames.TeamLeader, StringComparer.Ordinal);
        }

        public async Task<bool> LeadsTeamAsync(int userId, int gymId, int teamId, CancellationToken cancellationToken = default) =>
            (await GetLedTeamIdsAsync(userId, gymId, cancellationToken)).Contains(teamId);
    }
}
