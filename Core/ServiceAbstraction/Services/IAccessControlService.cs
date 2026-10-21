namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Central ADR-003 authorization guard used by the HR services. Enforces the two
    /// halves of the authorization formula at the service layer:
    /// (1) permission keys granted directly or through the user's roles, and
    /// (2) gym scope through UserGymAccess. Top Management bypasses both checks,
    /// mirroring the behavior established in <c>StationCodeService</c>.
    /// </summary>
    public interface IAccessControlService
    {
        /// <summary>
        /// Throws 401 unless the actor is active and holds the permission key
        /// (directly or via a role). Top Management always passes.
        /// </summary>
        Task EnsurePermissionAsync(int? actorUserId, string permissionKey, CancellationToken cancellationToken = default);

        /// <summary>
        /// Throws 401 unless the actor is active and has UserGymAccess to the gym.
        /// Top Management always passes.
        /// </summary>
        Task EnsureGymAccessAsync(int? actorUserId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Combined ADR-003 check: the permission key must be held, and when a gymId
        /// is supplied the actor must also have access to that gym. Top Management
        /// always passes.
        /// </summary>
        Task EnsurePermissionForGymAsync(int? actorUserId, string permissionKey, int? gymId, CancellationToken cancellationToken = default);
    }
}
