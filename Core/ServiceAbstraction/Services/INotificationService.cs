using Shared.DataTransferObject.Notification;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// The HR portal's Notifications &amp; Announcements tab (api-spec-from-ui.md §5.7):
    /// the signed-in user's notification inbox (list/unread/read/read-all) and the
    /// announcements broadcast history (list/compose/edit). Composing fans out
    /// individual notifications to the targeted audience.
    /// </summary>
    public interface INotificationService
    {
        /// <summary>My notifications, newest first (filters: unread flag + category).</summary>
        Task<NotificationListResponse> GetMyNotificationsAsync(int? actorUserId, NotificationListQuery query, CancellationToken cancellationToken = default);

        /// <summary>Number of unread notifications (header bell badge).</summary>
        Task<UnreadCountResponse> GetUnreadCountAsync(int? actorUserId, CancellationToken cancellationToken = default);

        /// <summary>Marks one of my notifications read.</summary>
        Task<NotificationItem> MarkReadAsync(int? actorUserId, int notificationId, CancellationToken cancellationToken = default);

        /// <summary>Marks every unread notification of the actor read.</summary>
        Task<MessageDataResponse> MarkAllReadAsync(int? actorUserId, CancellationToken cancellationToken = default);

        /// <summary>Announcement history (announcements.view, gym-scoped).</summary>
        Task<AnnouncementListResponse> GetAnnouncementsAsync(int? actorUserId, AnnouncementListQuery query, CancellationToken cancellationToken = default);

        /// <summary>Composes + sends an announcement to its audience (announcements.manage) → 201.</summary>
        Task<AnnouncementItem> CreateAnnouncementAsync(int? actorUserId, CreateAnnouncementRequest request, CancellationToken cancellationToken = default);

        /// <summary>Edits an announcement or retracts it (status → Cancelled) (announcements.manage).</summary>
        Task<AnnouncementItem> UpdateAnnouncementAsync(int? actorUserId, int announcementId, UpdateAnnouncementRequest request, CancellationToken cancellationToken = default);
    }
}
