using DomainLayer.Contracts;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.UserModule;

namespace Service.Specifications
{
    /// <summary>Notifications of one user, newest first.</summary>
    public class NotificationsByUserSpec : BaseSpecification<Notification, int>
    {
        public NotificationsByUserSpec(int userId, bool? unreadOnly = null)
        {
            Criteria = n => n.UserId == userId && (!unreadOnly.HasValue || !unreadOnly.Value || !n.IsRead);
            OrderByDescending = n => n.CreatedAt;
        }
    }

    /// <summary>Notification preference row of one user (1:1).</summary>
    public class UserNotificationPreferenceByUserSpec : BaseSpecification<UserNotificationPreference, int>
    {
        public UserNotificationPreferenceByUserSpec(int userId)
        {
            Criteria = p => p.UserId == userId;
        }
    }

    /// <summary>Unread notifications of one user.</summary>
    public class UnreadNotificationsByUserSpec : BaseSpecification<Notification, int>
    {
        public UnreadNotificationsByUserSpec(int userId)
        {
            Criteria = n => n.UserId == userId && !n.IsRead;
        }
    }
}
