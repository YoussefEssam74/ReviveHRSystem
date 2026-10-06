using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.NotificationModule
{
    /// <summary>
    /// Defines audience filtering criteria for an Announcement.
    /// Supports targeting by entire Gym, specific Department, specific Role, or Individual User.
    /// </summary>
    public class AnnouncementTarget : BaseEntity
    {
        public int AnnouncementId { get; set; }
        public virtual Announcement Announcement { get; set; } = null!;

        public AnnouncementTargetType TargetType { get; set; }

        public int? GymId { get; set; }
        public virtual Gym? Gym { get; set; }

        public int? DepartmentId { get; set; }
        public virtual Department? Department { get; set; }

        public int? RoleId { get; set; }
        public virtual Role? Role { get; set; }

        public int? UserId { get; set; }
        public virtual User? User { get; set; }
    }
}
