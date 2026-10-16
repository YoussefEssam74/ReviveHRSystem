using DomainLayer.Models.UserModule.Enums;

namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Join table for individual, user-level permission overrides.
    /// Grants a specific permission to a user even if their role doesn't include it.
    /// <see cref="Level"/> is the global feature access level (None/View/Edit) that
    /// applies in every gym the user can access (ADR-003 Amendment 1); per-gym
    /// grants live in UserGymPermission.
    /// </summary>
    public class UserPermission
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        public int PermissionId { get; set; }
        public virtual Permission Permission { get; set; } = null!;

        public AccessLevel Level { get; set; } = AccessLevel.None;
    }
}
