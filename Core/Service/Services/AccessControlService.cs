using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;

namespace Service.Services
{
    /// <summary>
    /// Implements the ADR-003 authorization formula in one place for the HR module:
    /// permission keys come from the user's roles plus direct grants, gym scope comes
    /// from UserGymAccess, and Top Management bypasses both. Every HR service should
    /// call these checks instead of re-implementing the rules.
    /// </summary>
    public sealed class AccessControlService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess) : IAccessControlService
    {
        public async Task EnsurePermissionAsync(int? actorUserId, string permissionKey, CancellationToken cancellationToken = default)
        {
            var user = await GetActiveActorAsync(actorUserId, cancellationToken);
            if (user.UserType == UserType.TopManagement)
            {
                return;
            }

            var permissionKeys = await userAccess.GetPermissionKeysAsync(user.Id, cancellationToken);
            if (!permissionKeys.Contains(permissionKey, StringComparer.Ordinal))
            {
                throw new UnAuthorizedException("You do not have permission to perform this action.");
            }
        }

        public async Task EnsureGymAccessAsync(int? actorUserId, int gymId, CancellationToken cancellationToken = default)
        {
            var user = await GetActiveActorAsync(actorUserId, cancellationToken);
            if (user.UserType == UserType.TopManagement)
            {
                return;
            }

            if (!await userAccess.HasGymAccessAsync(user.Id, gymId, cancellationToken))
            {
                throw new UnAuthorizedException("You do not have access to this gym.");
            }
        }

        public async Task EnsurePermissionForGymAsync(int? actorUserId, string permissionKey, int? gymId, CancellationToken cancellationToken = default)
        {
            var user = await GetActiveActorAsync(actorUserId, cancellationToken);
            if (user.UserType == UserType.TopManagement)
            {
                return;
            }

            // Keys follow the gym being acted on (ADR-003 Amendment 1): the
            // per-gym role defines what you may do THERE. A Branch Manager in
            // one gym who is a Team Leader in another cannot act there with the
            // other gym's keys; global role keys apply only when the user holds
            // no role in the gym at all.
            var permissionKeys = await userAccess.GetPermissionKeysForGymAsync(user.Id, gymId, cancellationToken);
            if (!permissionKeys.Contains(permissionKey, StringComparer.Ordinal))
            {
                throw new UnAuthorizedException("You do not have permission to perform this action.");
            }

            if (gymId.HasValue && !await userAccess.HasGymAccessAsync(user.Id, gymId.Value, cancellationToken))
            {
                throw new UnAuthorizedException("You do not have access to this gym.");
            }
        }

        private async Task<User> GetActiveActorAsync(int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null or <= 0)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var user = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserByIdSpec(actorUserId.Value), cancellationToken);

            if (user is null || !user.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            return user;
        }
    }
}
