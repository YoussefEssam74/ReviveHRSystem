using DomainLayer.Models.UserModule.Enums;

namespace DomainLayer.Contracts
{
    /// <summary>A gym the user can access, with its display name.</summary>
    public class GymAccessEntry
    {
        public int GymId { get; set; }
        public string GymName { get; set; } = string.Empty;

        /// <summary>Branch location shown beside the gym name in the portal (Gym.Location).</summary>
        public string Branch { get; set; } = string.Empty;
    }

    /// <summary>One feature access level for a user (global or per-gym source).</summary>
    public class FeatureLevelEntry
    {
        public string Feature { get; set; } = string.Empty;
        public AccessLevel Level { get; set; } = AccessLevel.None;
    }

    /// <summary>
    /// Read model over the identity join tables (UserGymAccess, UserPermissions,
    /// UserRoles/RolePermissions, UserGymRoles, UserGymPermissions). These join entities
    /// are not BaseEntity-derived, so they are exposed through this purpose-built
    /// contract instead of the generic repository. Implemented in
    /// Infrastructure/Persistence.
    /// </summary>
    public interface IUserAccessRepository
    {
        /// <summary>All gyms the user can access, with names.</summary>
        Task<IReadOnlyList<GymAccessEntry>> GetGymAccessAsync(int userId, CancellationToken cancellationToken = default);

        /// <summary>True when the user has UserGymAccess to the gym (ADR-004 check #1).</summary>
        Task<bool> HasGymAccessAsync(int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>Grants UserGymAccess to the gym when it is not already present (no-op otherwise).</summary>
        Task AddGymAccessAsync(int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>Removes UserGymAccess to the gym when present (no-op otherwise).</summary>
        Task RemoveGymAccessAsync(int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>Distinct permission keys from direct user permissions ∪ all role permissions.</summary>
        Task<IReadOnlyList<string>> GetPermissionKeysAsync(int userId, CancellationToken cancellationToken = default);

        /// <summary>Global feature levels (direct UserPermission rows, all gyms).</summary>
        Task<IReadOnlyList<FeatureLevelEntry>> GetGlobalLevelsAsync(int userId, CancellationToken cancellationToken = default);

        /// <summary>Individual per-gym feature grants (UserGymPermission rows).</summary>
        Task<IReadOnlyList<FeatureLevelEntry>> GetGymGrantLevelsAsync(int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Feature levels contributed by the roles assigned to the user for one gym
        /// (UserGymRoles → RolePermissions). One row per (feature, role); the caller
        /// aggregates with max-level semantics.
        /// </summary>
        Task<IReadOnlyList<FeatureLevelEntry>> GetGymRoleLevelsAsync(int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>Names of the roles assigned to the user for one gym.</summary>
        Task<IReadOnlyList<string>> GetGymRoleNamesAsync(int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>Role ids assigned to a user.</summary>
        Task<IReadOnlyList<int>> GetUserRoleIdsAsync(int userId, CancellationToken cancellationToken = default);

        /// <summary>Replaces a user's assigned roles wholesale (no-op when unchanged).</summary>
        Task ReplaceUserRolesAsync(int userId, IReadOnlyCollection<int> roleIds, CancellationToken cancellationToken = default);

        /// <summary>Direct (user-level) permission keys granted to a user.</summary>
        Task<IReadOnlyList<string>> GetUserDirectPermissionKeysAsync(int userId, CancellationToken cancellationToken = default);

        /// <summary>Replaces a user's direct (user-level) permissions wholesale (no-op when unchanged).</summary>
        Task ReplaceUserPermissionsAsync(int userId, IReadOnlyCollection<int> permissionIds, CancellationToken cancellationToken = default);

        /// <summary>Number of users assigned to a role (archived users and roles excluded by the join filters).</summary>
        Task<int> CountUsersWithRoleAsync(int roleId, CancellationToken cancellationToken = default);

        /// <summary>Archives a role by flipping the shadow IsDeleted flag (the UI's "Archive role" action).</summary>
        Task ArchiveRoleAsync(int roleId, CancellationToken cancellationToken = default);
    }
}
