using DomainLayer.Contracts;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.UserModule;

namespace Service.Specifications
{
    /// <summary>Notifications of one user, newest first.</summary>
    public class NotificationsByUserSpec : BaseSpecification<Notification, int>
    {
        public NotificationsByUserSpec(int userId)
        {
            Criteria = n => n.UserId == userId;
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
}
