namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Join table linking Roles to their granted Permissions.
    /// Defines what capabilities are bundled into each preset or custom role.
    /// </summary>
    public class RolePermission
    {
        public int RoleId { get; set; }
        public virtual Role Role { get; set; } = null!;

        public int PermissionId { get; set; }
        public virtual Permission Permission { get; set; } = null!;
    }
}
