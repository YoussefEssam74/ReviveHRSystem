using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.NotificationModule
{
    /// <summary>
    /// Represents an HR-authored outbound broadcast communication.
    /// Can be published immediately or scheduled for automated delivery. On send, fans out individual Notifications to targeted audience.
    /// </summary>
    public class Announcement : BaseEntity
    {
        public int AuthorId { get; set; }
        public virtual User Author { get; set; } = null!;

        public string Title { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public DateTime? ScheduledAt { get; set; }
        public DateTime? SentAt { get; set; }
        public AnnouncementStatus Status { get; set; } = AnnouncementStatus.Draft;

        public virtual ICollection<AnnouncementTarget> Targets { get; set; } = new List<AnnouncementTarget>();
    }
}
