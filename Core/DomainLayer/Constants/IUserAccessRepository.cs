namespace DomainLayer.Contracts
{
    /// <summary>A gym the user can access, with its display name.</summary>
    public class GymAccessEntry
    {
        public int GymId { get; set; }
        public string GymName { get; set; } = string.Empty;
    }

    /// <summary>
    /// Read model over the identity join tables (UserGymAccess, UserPermissions,
    /// UserRoles/RolePermissions). These join entities are not BaseEntity-derived, so
    /// they are exposed through this purpose-built contract instead of the generic
    /// repository. Implemented in Infrastructure/Persistence.
    /// </summary>
    public interface IUserAccessRepository
    {
        /// <summary>All gyms the user can access, with names.</summary>
        Task<IReadOnlyList<GymAccessEntry>> GetGymAccessAsync(int userId, CancellationToken cancellationToken = default);

        /// <summary>True when the user has UserGymAccess to the gym (ADR-004 check #1).</summary>
        Task<bool> HasGymAccessAsync(int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>Distinct permission keys from direct user permissions ∪ all role permissions.</summary>
        Task<IReadOnlyList<string>> GetPermissionKeysAsync(int userId, CancellationToken cancellationToken = default);
    }
}
