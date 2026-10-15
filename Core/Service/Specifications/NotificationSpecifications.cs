using DomainLayer.Contracts;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.UserModule;

namespace Service.Specifications
{
    /// <summary>
    /// Notification &amp; announcement specifications (api-spec-from-ui.md §5.7).
    /// The inbox is always user-scoped; announcement listing is gym-scope filtered
    /// (null/empty array matches nobody — never everything, per ADR-003).
    /// </summary>
    public sealed class NotificationsByUserSpec : BaseSpecification<Notification, int>
    {
        public NotificationsByUserSpec(int userId, bool unreadOnly, NotificationType? category, int skip = 0, int take = 0)
        {
            Criteria = n =>
                n.UserId == userId &&
                (!unreadOnly || !n.IsRead) &&
                (category == null || n.Type == category);

            OrderByDescending = n => n.CreatedAt;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>Announcement fan-out rows sharing a title prefix (read-rate + retraction).</summary>
    public sealed class NotificationsByTitleSpec : BaseSpecification<Notification, int>
    {
        public NotificationsByTitleSpec(string titlePrefix)
        {
            var clean = titlePrefix.Trim().ToLower();
            Criteria = n => n.Title.ToLower().StartsWith(clean) && n.Type == NotificationType.Announcement;
        }
    }

    /// <summary>Announcement history, optionally gym-scoped through its audience target.</summary>
    public sealed class AnnouncementListSpec : BaseSpecification<Announcement, int>
    {
        public AnnouncementListSpec(int[]? gymIds, AnnouncementStatus? status, int skip, int take)
        {
            Criteria = a =>
                (a.Targets.Any() || (gymIds != null && gymIds.Length > 0)) &&
                (status == null || a.Status == status) &&
                (gymIds == null || gymIds.Length == 0
                    || a.Targets.Any(t => t.GymId == null || (t.GymId != null && gymIds.Contains(t.GymId.Value))));

            AddInclude(a => a.Targets);
            OrderByDescending = a => a.Id;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>One announcement with its audience targets (edit/retract path).</summary>
    public sealed class AnnouncementByIdSpec : BaseSpecification<Announcement, int>
    {
        public AnnouncementByIdSpec(int announcementId)
        {
            Criteria = a => a.Id == announcementId;
            AddInclude(a => a.Targets);
        }
    }

    /// <summary>Active, non-archived users (announcement fan-out recipients).</summary>
    public sealed class ActiveUsersSpec : BaseSpecification<User, int>
    {
        public ActiveUsersSpec()
        {
            Criteria = u => u.IsActive;
        }
    }
}
