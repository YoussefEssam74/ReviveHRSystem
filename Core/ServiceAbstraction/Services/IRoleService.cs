using Shared.DataTransferObject.Permission;
using Shared.DataTransferObject.Role;
using Shared.DataTransferObject.User;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Roles &amp; permissions admin (S2): the roles CRUD (7.1–7.6), the permission
    /// catalog (6.7 / My Access matrix), and the user-level assignment endpoints
    /// (6.4 direct permissions, 6.5 role presets, 6.6 gym access). Every method is
    /// gated by team.view / team.manage inside the service (ADR-003).
    /// </summary>
    public interface IRoleService
    {
        /// <summary>Paged roles list with permission/user counters (team.view).</summary>
        Task<RolesListResponse> GetRolesAsync(int? actorUserId, RoleListQuery query, CancellationToken cancellationToken = default);

        /// <summary>Creates a role, optionally cloning the permission set from another role (team.manage).</summary>
        Task<RoleDataResponse> CreateRoleAsync(int? actorUserId, CreateRoleRequest request, CancellationToken cancellationToken = default);

        /// <summary>Updates name/description and optionally replaces the permission set (team.manage).</summary>
        Task<RoleDataResponse> UpdateRoleAsync(int? actorUserId, int roleId, UpdateRoleRequest request, CancellationToken cancellationToken = default);

        /// <summary>Replaces the role's permission keys wholesale — the Configure flow (team.manage).</summary>
        Task<RolePermissionsResponse> SetRolePermissionsAsync(int? actorUserId, int roleId, SetRolePermissionsRequest request, CancellationToken cancellationToken = default);

        /// <summary>Creates a new role copying the source role's permission set (team.manage).</summary>
        Task<RoleDataResponse> CloneRoleAsync(int? actorUserId, int roleId, CloneRoleRequest request, CancellationToken cancellationToken = default);

        /// <summary>Archives a role (204). Roles still assigned to users are rejected (team.manage).</summary>
        Task ArchiveRoleAsync(int? actorUserId, int roleId, CancellationToken cancellationToken = default);

        /// <summary>The tracked permission catalog, flat and area-grouped (team.view).</summary>
        Task<PermissionCatalogResponse> GetPermissionCatalogAsync(int? actorUserId, CancellationToken cancellationToken = default);

        /// <summary>Replaces a user's direct (user-level) permission keys (6.4, team.manage).</summary>
        Task<UserAssignmentResponse> ReplaceUserPermissionsAsync(int? actorUserId, int userId, UserPermissionsRequest request, CancellationToken cancellationToken = default);

        /// <summary>Assigns a single role by id or preset name, or clears roles when both are null (6.5, team.manage).</summary>
        Task<UserAssignmentResponse> ReplaceUserRolesAsync(int? actorUserId, int userId, UserRoleAssignmentRequest request, CancellationToken cancellationToken = default);

        /// <summary>Replaces a user's gym access by gym ids and/or names; an empty set revokes all (6.6, team.manage).</summary>
        Task<UserAssignmentResponse> ReplaceUserGymAccessAsync(int? actorUserId, int userId, UserGymAccessRequest request, CancellationToken cancellationToken = default);

        /// <summary>GET /api/users/{id} — access profile (own id, or any id with team.view).</summary>
        Task<UserAccessProfileResponse> GetUserAccessProfileAsync(int? actorUserId, int userId, CancellationToken cancellationToken = default);
    }
}
