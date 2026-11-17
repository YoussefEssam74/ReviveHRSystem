namespace Shared.DataTransferObject.User
{
    // ------------------------------------------------------------------
    // GET /api/users/{id} — My Access page (api-spec-from-ui.md §5.8)
    // ------------------------------------------------------------------

    /// <summary>
    /// The signed-in user's access summary (or an admin's view of any user):
    /// ASSIGNED GYMS, PERMISSION SUMMARY, and the "You ({role})" matrix row.
    /// </summary>
    public class UserAccessProfileResponse
    {
        public UserAccessProfileData Data { get; set; } = null!;
    }

    public class UserAccessProfileData
    {
        public int Id { get; set; }
        public string Email { get; set; } = string.Empty;
        /// <summary>Primary role name ("HR Manager"), or the user type label when role-less.</summary>
        public string Role { get; set; } = string.Empty;
        /// <summary>Direct (user-level) permission keys.</summary>
        public List<string> Permissions { get; set; } = [];
        public List<UserAccessGymItem> Gyms { get; set; } = [];
        /// <summary>Direct ∪ role permissions — what the permission matrix computes from.</summary>
        public List<string> EffectivePermissions { get; set; } = [];
        /// <summary>Permission-summary counters (granted vs tracked catalog size).</summary>
        public int GrantedCount { get; set; }
        public int TrackedCount { get; set; }
    }

    /// <summary>One assigned gym: `{ id, name, branch }`.</summary>
    public class UserAccessGymItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        /// <summary>Gym.Location shown beside the name.</summary>
        public string Branch { get; set; } = string.Empty;
    }
}
