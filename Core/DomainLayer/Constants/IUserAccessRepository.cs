using DomainLayer.Models.UserModule.Enums;

namespace DomainLayer.Contracts
{
    /// <summary>A gym the user can access, with its display name.</summary>
    public class GymAccessEntry
    {
        public int GymId { get; set; }
        public string GymName { get; set; } = string.Empty;
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
    }
}
