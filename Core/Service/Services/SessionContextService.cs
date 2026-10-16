using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Auth;

namespace Service.Services
{
    /// <summary>
    /// Builds the session context (identity, gyms, per-gym role, effective feature
    /// levels) and performs the in-session gym switch (ADR-002 Amendment 1).
    /// </summary>
    public class SessionContextService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess,
        IPermissionService permissionService,
        ITeamScopeService teamScopeService,
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

            var permissionKeys = await userAccess.GetPermissionKeysAsync(user.Id, cancellationToken);
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
            IReadOnlyDictionary<string, int> featureLevels = new Dictionary<string, int>();

            if (activeGym is not null)
            {
                var roleNames = await userAccess.GetGymRoleNamesAsync(user.Id, activeGym.GymId, cancellationToken);
                roleInActiveGym = roleNames.Count > 0 ? roleNames[0] : null;

                // Only relevant for team-scoped sessions, but harmless to resolve always:
                // null unless the user leads a team in the active gym.
                ledTeamId = await teamScopeService.GetLedTeamIdAsync(user.Id, activeGym.GymId, cancellationToken);

                var levels = await permissionService.GetEffectiveLevelsAsync(user.Id, activeGym.GymId, cancellationToken);
                featureLevels = levels.ToDictionary(kv => kv.Key, kv => (int)kv.Value);
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
                FeatureLevels = featureLevels
            };
        }
    }
}
