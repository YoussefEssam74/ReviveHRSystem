using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.UserModule.Enums;

namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Represents an authenticated system user account (Super Admin, HR, or Employee).
    /// Stores login credentials, active status, and links to roles, gym access scopes, and employee profiles.
    /// </summary>
    public class User : BaseEntity<int>
    {
        public string Email { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public UserType UserType { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime? LastLoginAt { get; set; }

        /// <summary>
        /// Consecutive failed sign-in attempts (brute-force lockout, enforced in
        /// AuthService). Reset on a successful login; once the counter reaches the
        /// configured maximum the account answers every sign-in with a lock error
        /// until <see cref="LockoutEnd"/> passes (stored UTC).
        /// </summary>
        public int FailedLoginAttempts { get; set; }
        public DateTime? LockoutEnd { get; set; }

        // Navigation properties
        public virtual ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
        public virtual ICollection<UserPermission> UserPermissions { get; set; } = new List<UserPermission>();
        public virtual ICollection<UserGymAccess> UserGymAccesses { get; set; } = new List<UserGymAccess>();
        public virtual ICollection<UserGymRole> UserGymRoles { get; set; } = new List<UserGymRole>();
        public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();
        public virtual Employee? EmployeeProfile { get; set; }
        public virtual UserNotificationPreference? NotificationPreference { get; set; }
    }
}

