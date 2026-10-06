namespace DomainLayer.Models.NotificationModule.Enums
{
    /// <summary>
    /// Represents the publishing lifecycle of an HR broadcast announcement.
    /// Draft, Scheduled (queued for future automated dispatch), Sent, Cancelled.
    /// </summary>
    public enum AnnouncementStatus
    {
        Draft = 1,
        Scheduled = 2,
        Sent = 3,
        Cancelled = 4
    }
}
