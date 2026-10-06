using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.NotificationModule
{
    /// <summary>
    /// Represents an informational, inbound notification delivered to a user's notification bell/inbox.
    /// Deep-links to relevant pages (e.g. approved request, schedule changes, upcoming interviews).
    /// </summary>
    public class Notification : BaseEntity
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public NotificationType Type { get; set; }
        public bool IsRead { get; set; } = false;
        public string? LinkTo { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
