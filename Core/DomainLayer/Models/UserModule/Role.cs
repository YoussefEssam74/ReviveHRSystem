namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Represents a security role or preset bundle of permissions (e.g., HR Manager, HR, Branch Manager, Team Leader).
    /// Used as a shortcut to grant collections of permissions to users.
    /// </summary>
    public class Role : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsPreset { get; set; } = false;

        public virtual ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
        public virtual ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
    }
}
