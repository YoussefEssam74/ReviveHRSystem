namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Represents an atomic, granular permission key (e.g., 'employees.create', 'attendance.edit', 'payroll.approve').
    /// The fundamental building block of the authorization system.
    /// </summary>
    public class Permission : BaseEntity<int>
    {
        public string Key { get; set; } = string.Empty;
        public string Area { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsSystem { get; set; } = true;

        public virtual ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
        public virtual ICollection<UserPermission> UserPermissions { get; set; } = new List<UserPermission>();
    }
}

