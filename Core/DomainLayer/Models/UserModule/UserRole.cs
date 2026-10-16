namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Join table mapping Users to their assigned Roles.
    /// Allows users to inherit all permissions configured on that role.
    /// </summary>
    public class UserRole
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        public int RoleId { get; set; }
        public virtual Role Role { get; set; } = null!;
    }
}
