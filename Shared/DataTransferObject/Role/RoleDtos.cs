namespace Shared.DataTransferObject.Role
{
    /// <summary>
    /// One role row of the Roles &amp; Permissions admin page (GET /api/roles):
    /// identity, description, display status, and the counters/cards render
    /// (permissions granted, users assigned, and the "Empty" badge flag). The
    /// permission keys are included so the detail/matrix views can hydrate.
    /// </summary>
    public class RoleListItem
    {
        public int Id { get; init; }
        public required string Name { get; init; }
        public string? Description { get; init; }
        public required string Status { get; init; }
        public int PermissionsCount { get; init; }
        public int UsersCount { get; init; }
        public bool IsEmpty { get; init; }
        public bool IsPreset { get; init; }
        public required List<string> Permissions { get; init; }
    }

    /// <summary>Query options for the roles list (7.1): search + pager.</summary>
    public class RoleListQuery
    {
        /// <summary>Case-insensitive substring of the role name or description.</summary>
        public string? Search { get; init; }

        public int Page { get; init; } = 1;

        public int PageSize { get; init; } = 20;
    }

    /// <summary>Pagination envelope for the roles list ({ items, …pager }).</summary>
    public class RolesListResponse
    {
        public required IReadOnlyList<RoleListItem> Items { get; init; }
        public int Page { get; init; }
        public int PageSize { get; init; }
        public int Total { get; init; }
        public int TotalPages { get; init; }
    }

    /// <summary>Single-role envelope ({ data }) for create/update/clone responses.</summary>
    public class RoleDataResponse
    {
        public required RoleListItem Data { get; init; }
    }

    /// <summary>
    /// Create/Edit Role body (7.2/7.3): a required name, optional description,
    /// optional permission keys, and an optional template to clone the permission
    /// set from (Create Role modal's "clone from" affordance).
    /// </summary>
    public class CreateRoleRequest
    {
        public required string Name { get; init; }
        public string? Description { get; init; }
        public int? CloneFromRoleId { get; init; }
        public List<string>? Permissions { get; init; }
    }

    /// <summary>Update Role body (7.3) — same shape as create.</summary>
    public class UpdateRoleRequest
    {
        public required string Name { get; init; }
        public string? Description { get; init; }
        public List<string>? Permissions { get; init; }
    }

    /// <summary>Configure-permissions body (7.4): the full replacement permission set.</summary>
    public class SetRolePermissionsRequest
    {
        public required List<string> Permissions { get; init; }
    }

    /// <summary>Configure-permissions response (7.4): { data: { id, permissions } }.</summary>
    public class RolePermissionsResponse
    {
        public required RolePermissionData Data { get; init; }
    }

    public class RolePermissionData
    {
        public int Id { get; init; }
        public required List<string> Permissions { get; init; }
    }

    /// <summary>Clone Role body (7.5): the new role's name; permission set is copied.</summary>
    public class CloneRoleRequest
    {
        public required string Name { get; init; }
    }
}
