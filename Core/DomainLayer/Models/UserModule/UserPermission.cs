namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Join table for individual, user-level permission overrides.
    /// Grants a specific permission to a user even if their role doesn't include it.
    /// </summary>
    public class UserPermission
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        public int PermissionId { get; set; }
        public virtual Permission Permission { get; set; } = null!;
    }
}
