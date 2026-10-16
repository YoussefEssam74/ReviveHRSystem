using DomainLayer.Models.UserModule.Enums;

namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Join table linking Roles to their granted Permissions.
    /// Defines what capabilities are bundled into each preset or custom role.
    /// <see cref="Level"/> is the feature access level (None/View/Edit) the role
    /// grants for the feature (ADR-003 Amendment 1).
    /// </summary>
    public class RolePermission
    {
        public int RoleId { get; set; }
        public virtual Role Role { get; set; } = null!;

        public int PermissionId { get; set; }
        public virtual Permission Permission { get; set; } = null!;

        public AccessLevel Level { get; set; } = AccessLevel.None;
    }
}
