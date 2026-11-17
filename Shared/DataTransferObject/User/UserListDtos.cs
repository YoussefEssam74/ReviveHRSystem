namespace Shared.DataTransferObject.User
{
    // ------------------------------------------------------------------
    // GET /api/users — HR Team Management member list (mock HR §HR Team)
    // ------------------------------------------------------------------

    /// <summary>Query options for the team member list: scope, search, status + pager.</summary>
    public class UserListQuery
    {
        /// <summary>Gym id or branch name; blank = the actor's full scope.</summary>
        public string? Gym { get; init; }

        /// <summary>staff (default) | hr | topmanagement | employee | all.</summary>
        public string? Type { get; init; }

        /// <summary>Case-insensitive substring of name, email or username.</summary>
        public string? Search { get; init; }

        /// <summary>"Active" | "Suspended" — omitted returns every member.</summary>
        public string? Status { get; init; }

        public int Page { get; init; } = 1;

        public int PageSize { get; init; } = 20;
    }

    /// <summary>
    /// One HR Team row: identity, primary role (the template badge), assigned
    /// gyms, effective-permission counters (the access bar), display status and
    /// last login. The full effective permission key set rides along so the
    /// member detail / edit modal can hydrate without a second call.
    /// </summary>
    public class UserListItem
    {
        public int Id { get; init; }
        public required string Name { get; init; }
        public required string Email { get; init; }
        /// <summary>Two-letter avatar derived from the name.</summary>
        public required string Initials { get; init; }
        /// <summary>Primary role name ("HR-FullAccess"), or the user type label when role-less.</summary>
        public required string Role { get; init; }
        /// <summary>Preset role names assigned to the user (badge source).</summary>
        public required List<string> Roles { get; init; }
        public required List<string> Gyms { get; init; }
        /// <summary>Effective (direct ∪ role) permission count — the access bar.</summary>
        public int PermissionsCount { get; init; }
        public required List<string> Permissions { get; init; }
        /// <summary>Display status mirroring the UI: "Active" | "Suspended".</summary>
        public required string Status { get; init; }
        public DateTime? LastLoginAt { get; init; }
    }

    /// <summary>Pagination envelope for the team member list ({ items, …pager }).</summary>
    public class UsersListResponse
    {
        public required IReadOnlyList<UserListItem> Items { get; init; }
        public int Page { get; init; }
        public int PageSize { get; init; }
        public int Total { get; init; }
        public int TotalPages { get; init; }
    }
}
