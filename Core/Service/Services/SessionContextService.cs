using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule;
using Microsoft.EntityFrameworkCore;
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

            // Rotate the refresh credential together with the access token: the
            // replacement refresh row is scoped to the TARGET gym, so the silent
            // refreshes that follow this switch (15-min access-token TTL, tab
            // reloads) re-issue gym2-scoped tokens. Without the rotation the
            // original login's row would keep its old scope and every refresh
            // would un-do the switch, snapping the session back to the gym it
            // logged into (the refresh endpoint preserves its token's scope).
            var plainRefreshToken = tokenService.GenerateRefreshToken();
            var newTokenHash = tokenService.HashRefreshToken(plainRefreshToken);
            var refreshRepo = unitOfWork.GetRepository<DomainLayer.Models.UserModule.RefreshToken, int>();
            await refreshRepo.AddAsync(
                new DomainLayer.Models.UserModule.RefreshToken
                {
                    UserId = user.Id,
                    TokenHash = newTokenHash,
                    ScopedGymId = gymId,
                    ExpiresAtUtc = tokenService.RefreshTokenExpiresAtUtc
                }, cancellationToken);

            // Revoke every OTHER alive refresh chain of this user in the same
            // transaction. Leaving old chains alive proved unsafe in practice: a
            // stale SPA context (another tab, or a tab still running a previous
            // build with an old in-memory session) kept one, hit its 401-retry,
            // refreshed against it and got a token re-scoped to the PREVIOUS gym
            // (RefreshAsync preserves chain scope), overwriting the persisted
            // session so the UI silently flipped back to the old gym with no
            // error — the exact "stays in the main gym" report. With
            // single-live-chain discipline a stale credential is refused: its
            // holder is signed out (visible state) instead of resurrecting the
            // old gym scope. The new row is excluded by hash (its Id is not
            // assigned until the save).
            var staleChain = await refreshRepo.GetAllAsync(
                new RefreshTokensByUserActiveSpec(user.Id), cancellationToken);
            foreach (var zombie in staleChain)
            {
                zombie.RevokedAtUtc = DateTime.UtcNow;
                refreshRepo.Update(zombie);
            }

            // A concurrent refresh may claim one of the fetched chains between the
            // read and this save (xmin concurrency): that update is rejected, but
            // the switch itself must not fail — reload the rejected rows (fresh
            // stamps; the winner already revoked/rotated them anyway) and persist
            // the sweep. Mirrors RevokeAllUserRefreshTokensAsync in AuthService; a
            // row-192 identity gap in RefreshTokens proved the unguarded version
            // rolled the whole switch back when a stale scope raced it.
            try
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException exception)
            {
                foreach (var entry in exception.Entries)
                {
                    await entry.ReloadAsync(cancellationToken);
                }

                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            var me = await BuildMeAsync(user, gyms, new GymOption { GymId = gym.Id, GymName = gym.Name }, cancellationToken);

            return new SwitchGymResponse
            {
                AccessToken = accessToken,
                ExpiresInSeconds = tokenService.AccessTokenExpiresInSeconds,
                RefreshToken = plainRefreshToken,
                RefreshExpiresInSeconds = (int)(tokenService.RefreshTokenExpiresAtUtc - DateTime.UtcNow).TotalSeconds,
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
