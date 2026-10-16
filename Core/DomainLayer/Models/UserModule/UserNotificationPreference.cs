namespace DomainLayer.Models.UserModule
{
    /// <summary>User's in-app notification category preferences.</summary>
    public class UserNotificationPreference : BaseEntity<int>
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        public bool Requests { get; set; } = true;
        public bool Attendance { get; set; } = true;
        public bool Recruitment { get; set; } = true;
        public bool Management { get; set; } = true;
        public bool Announcements { get; set; } = true;
    }
}
