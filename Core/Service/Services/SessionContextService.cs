using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.Auth;

namespace Service.Services
{
    /// <summary>
    /// Builds the session context (identity, gyms, per-gym role) and performs the
    /// in-session gym switch (ADR-002 Amendment 1).
    /// </summary>
    public class SessionContextService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess,
        ITeamScopeService teamScopeService,
        IEmployeeAccessService employeeAccessService,
        ITokenService tokenService,
        IMapper mapper) : ISessionContextService
    {
        public async Task<MeResponse> GetMeAsync(int userId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var user = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserByIdSpec(userId), cancellationToken)
                ?? throw new UnAuthorizedException("Your session is invalid. Please sign in again.");

            if (!user.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var gymAccess = await userAccess.GetGymAccessAsync(user.Id, cancellationToken);
            var gyms = mapper.Map<GymOption[]>(gymAccess);

            var activeGym = activeGymId.HasValue
                ? gyms.FirstOrDefault(g => g.GymId == activeGymId.Value)
                : null;

            return await BuildMeAsync(user, gyms, activeGym, cancellationToken);
        }

        public async Task<SwitchGymResponse> SwitchGymAsync(int userId, int gymId, CancellationToken cancellationToken = default)
        {
            var user = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserByIdSpec(userId), cancellationToken)
                ?? throw new UnAuthorizedException("Your session is invalid. Please sign in again.");

            if (!user.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var gym = await unitOfWork.GetRepository<Gym, int>().GetByIdAsync(gymId, cancellationToken);

            // Unknown gym and no-access gym answer identically: the caller simply
            // cannot switch to it (ADR-002 Amendment 1).
            if (gym is null || gym.Status != GymStatus.Active || !await userAccess.HasGymAccessAsync(user.Id, gymId, cancellationToken))
            {
                throw new UnAuthorizedException("You do not have access to the selected gym.");
            }

            var gymAccess = await userAccess.GetGymAccessAsync(user.Id, cancellationToken);
            var gyms = mapper.Map<GymOption[]>(gymAccess);

            // The switched-to token carries the TARGET gym's keys: a Branch Manager
            // in one gym who leads a team in another arrives there as a Team Leader.
            var permissionKeys = await userAccess.GetPermissionKeysForGymAsync(user.Id, gymId, cancellationToken);
            var accessToken = tokenService.CreateAccessToken(user, permissionKeys, gymId);

            var me = await BuildMeAsync(user, gyms, new GymOption { GymId = gym.Id, GymName = gym.Name }, cancellationToken);

            return new SwitchGymResponse
            {
                AccessToken = accessToken,
                ExpiresInSeconds = tokenService.AccessTokenExpiresInSeconds,
                Me = me
            };
        }

        private async Task<MeResponse> BuildMeAsync(
            User user, GymOption[] gyms, GymOption? activeGym, CancellationToken cancellationToken)
        {
            string? roleInActiveGym = null;
            int? ledTeamId = null;
            int? employeeId = await employeeAccessService.GetOwnEmployeeIdAsync(user.Id, cancellationToken);

            if (activeGym is not null)
            {
                var roleNames = await userAccess.GetGymRoleNamesAsync(user.Id, activeGym.GymId, cancellationToken);
                roleInActiveGym = PickPrimaryRole(roleNames);

                // Only relevant for team-scoped sessions, but harmless to resolve always:
                // null unless the user leads a team in the active gym.
                ledTeamId = await teamScopeService.GetLedTeamIdAsync(user.Id, activeGym.GymId, cancellationToken);
            }

            return new MeResponse
            {
                UserId = user.Id,
                Email = user.Email,
                UserName = user.UserName,
                UserType = user.UserType.ToString(),
                ActiveGym = activeGym,
                Gyms = gyms,
                RoleInActiveGym = roleInActiveGym,
                LedTeamId = ledTeamId,
                EmployeeId = employeeId
            };
        }

        /// <summary>
        /// A user may hold several roles in one gym (assignments are managed on the
        /// Roles &amp; Permissions page); the session label reports the most capable
        /// one deterministically instead of depending on DB row order.
        /// </summary>
        private static string? PickPrimaryRole(IReadOnlyList<string> roleNames)
        {
            if (roleNames.Count == 0)
            {
                return null;
            }

            string[] precedence =
            [
                RoleNames.BranchManager,
                RoleNames.TeamLeader,
                RoleNames.HrManager,
                RoleNames.Hr,
                RoleNames.SuperAdmin,
                RoleNames.Employee,
            ];

            foreach (var name in precedence)
            {
                if (roleNames.Contains(name, StringComparer.Ordinal))
                {
                    return name;
                }
            }

            return roleNames[0];
        }
    }
}
