using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.Notification;

namespace Service.Services
{
    /// <summary>
    /// Notifications &amp; announcements (api-spec-from-ui.md §5.7). The inbox is
    /// strictly the signed-in user's own rows; announcements are composed by HR
    /// (announcements.manage), fanned out to the targeted audience as individual
    /// notifications, and the card's read-rate is computed from those fan-outs.
    /// </summary>
    public sealed class NotificationService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess) : INotificationService
    {
        // ==================================================================
        // Notifications (my inbox)
        // ==================================================================

        public async Task<NotificationListResponse> GetMyNotificationsAsync(int? actorUserId, NotificationListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);
            var category = ParseCategoryOrNull(query.Category);

            var total = await _unitOfWork.GetRepository<Notification, int>()
                .CountAsync(new NotificationsByUserSpec(actor.Id, query.Unread == true, category), cancellationToken);
            var rows = await _unitOfWork.GetRepository<Notification, int>()
                .GetAllAsync(new NotificationsByUserSpec(actor.Id, query.Unread == true, category, (page - 1) * pageSize, pageSize), cancellationToken);

            return new NotificationListResponse
            {
                Items = rows.Select(BuildItem).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<UnreadCountResponse> GetUnreadCountAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var count = await _unitOfWork.GetRepository<Notification, int>()
                .CountAsync(new NotificationsByUserSpec(actor.Id, true, null), cancellationToken);
            return new UnreadCountResponse { Count = count };
        }

        public async Task<NotificationItem> MarkReadAsync(int? actorUserId, int notificationId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var notification = await _unitOfWork.GetRepository<Notification, int>()
                .GetByIdAsync(notificationId, cancellationToken)
                ?? throw new NotFoundException("Notification not found.");
            if (notification.UserId != actor.Id)
            {
                throw new NotFoundException("Notification not found.");
            }

            if (!notification.IsRead)
            {
                notification.IsRead = true;
                _unitOfWork.GetRepository<Notification, int>().Update(notification);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return BuildItem(notification);
        }

        public async Task<MessageDataResponse> MarkAllReadAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var unread = await _unitOfWork.GetRepository<Notification, int>()
                .GetAllAsync(new NotificationsByUserSpec(actor.Id, true, null), cancellationToken);
            foreach (var notification in unread)
            {
                notification.IsRead = true;
                _unitOfWork.GetRepository<Notification, int>().Update(notification);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return new MessageDataResponse { Message = "All notifications marked read." };
        }

        // ==================================================================
        // Announcements
        // ==================================================================

        public async Task<AnnouncementListResponse> GetAnnouncementsAsync(int? actorUserId, AnnouncementListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "announcements.view", cancellationToken);
            var gymIds = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, query.Gym, cancellationToken);

            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);
            var status = ParseStatusOrNull(query.Status);

            var total = await _unitOfWork.GetRepository<Announcement, int>()
                .CountAsync(new AnnouncementListSpec(gymIds, status, 0, 0), cancellationToken);
            var rows = await _unitOfWork.GetRepository<Announcement, int>()
                .GetAllAsync(new AnnouncementListSpec(gymIds, status, (page - 1) * pageSize, pageSize), cancellationToken);

            return new AnnouncementListResponse
            {
                Items = await BuildItemsAsync(rows, cancellationToken),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<AnnouncementItem> CreateAnnouncementAsync(int? actorUserId, CreateAnnouncementRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "announcements.manage", cancellationToken);

            var title = HrPortalHelpers.NullIfBlank(request.Title)
                ?? throw new BadRequestException("Title is required.");
            var message = HrPortalHelpers.NullIfBlank(request.Message)
                ?? throw new BadRequestException("Message is required.");
            var audience = HrPortalHelpers.NullIfBlank(request.Audience) ?? "All Employees";
            var type = HrPortalHelpers.NullIfBlank(request.Type) ?? "Reminder";

            var announcement = new Announcement
            {
                AuthorId = actor.Id,
                Title = title,
                Body = message,
                Status = AnnouncementStatus.Sent,
                SentAt = DateTime.UtcNow,
            };
            await _unitOfWork.GetRepository<Announcement, int>().AddAsync(announcement, cancellationToken);

            var target = await ResolveAudienceTargetAsync(audience, cancellationToken);
            announcement.Targets.Add(target);

            // Fan out one notification per targeted user (the read-rate denominator).
            var recipients = await ResolveAudienceUsersAsync(target, cancellationToken);
            var sentAt = announcement.SentAt!.Value;
            foreach (var user in recipients)
            {
                await _unitOfWork.GetRepository<Notification, int>().AddAsync(new Notification
                {
                    UserId = user.Id,
                    Title = $"Announcement: {title}",
                    Message = message,
                    Type = NotificationType.Announcement,
                    IsRead = false,
                    LinkTo = "announcements",
                    CreatedAt = sentAt,
                }, cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new AnnouncementItem
            {
                Id = announcement.Id,
                Title = announcement.Title,
                Audience = audience,
                Type = type,
                SentDate = announcement.SentAt,
                Status = "Sent",
                ReadRate = 0,
                Message = announcement.Body,
            };
        }

        public async Task<AnnouncementItem> UpdateAnnouncementAsync(int? actorUserId, int announcementId, UpdateAnnouncementRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "announcements.manage", cancellationToken);

            var announcement = await _unitOfWork.GetRepository<Announcement, int>()
                .GetByIdAsync(new AnnouncementByIdSpec(announcementId), cancellationToken)
                ?? throw new NotFoundException("Announcement not found.");

            var title = HrPortalHelpers.NullIfBlank(request.Title);
            if (title is not null)
            {
                announcement.Title = title;
            }

            var message = HrPortalHelpers.NullIfBlank(request.Message);
            if (message is not null)
            {
                announcement.Body = message;
            }

            var status = HrPortalHelpers.NullIfBlank(request.Status);
            if (status is not null)
            {
                announcement.Status = ParseStatusOrNull(status) ?? announcement.Status;
                if (announcement.Status == AnnouncementStatus.Sent && announcement.SentAt is null)
                {
                    announcement.SentAt = DateTime.UtcNow;
                }
            }

            // A retracted (cancelled) announcement stops delivering: drop its fan-out.
            if (announcement.Status == AnnouncementStatus.Cancelled)
            {
                var delivered = await _unitOfWork.GetRepository<Notification, int>()
                    .GetAllAsync(new NotificationsByTitleSpec($"Announcement: {announcement.Title}"), cancellationToken);
                foreach (var notification in delivered)
                {
                    _unitOfWork.GetRepository<Notification, int>().Remove(notification);
                }
            }

            _unitOfWork.GetRepository<Announcement, int>().Update(announcement);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var items = await BuildItemsAsync([announcement], cancellationToken);
            return items[0];
        }

        // ==================================================================
        // Helpers
        // ==================================================================

        private static NotificationItem BuildItem(Notification notification) => new()
        {
            Id = notification.Id,
            Category = CategoryOf(notification.Type),
            Title = notification.Title,
            Description = notification.Message,
            Date = notification.CreatedAt,
            Read = notification.IsRead,
            Color = ColorOf(notification.Type),
            Link = notification.LinkTo,
        };

        /// <summary>NotificationType → the UI's category badge.</summary>
        private static string CategoryOf(NotificationType type) => type switch
        {
            NotificationType.RequestUpdate => "Requests",
            NotificationType.RecruitmentFollowUp => "Recruitment",
            NotificationType.ContractExpiry => "Document",
            NotificationType.Announcement => "Announcements",
            _ => "System",
        };

        /// <summary>Category → badge tone (yellow | green | blue | red | purple).</summary>
        private static string ColorOf(NotificationType type) => type switch
        {
            NotificationType.RequestUpdate => "yellow",
            NotificationType.RecruitmentFollowUp => "green",
            NotificationType.ContractExpiry => "red",
            NotificationType.Announcement => "purple",
            _ => "blue",
        };

        private static NotificationType? ParseCategoryOrNull(string? category) => category?.Trim().ToLowerInvariant() switch
        {
            "requests" => NotificationType.RequestUpdate,
            "recruitment" => NotificationType.RecruitmentFollowUp,
            "document" => NotificationType.ContractExpiry,
            "announcements" => NotificationType.Announcement,
            "system" => NotificationType.SystemUpdate,
            _ => null,
        };

        private static AnnouncementStatus? ParseStatusOrNull(string? status) => status?.Trim().ToLowerInvariant() switch
        {
            "draft" => AnnouncementStatus.Draft,
            "scheduled" => AnnouncementStatus.Scheduled,
            "sent" => AnnouncementStatus.Sent,
            "cancelled" or "canceled" => AnnouncementStatus.Cancelled,
            _ => null,
        };

        /// <summary>"All Employees" → org-wide target; a branch name → that gym; "Trainers only" → role/position hint (all users, filtered client-side by title).</summary>
        private async Task<AnnouncementTarget> ResolveAudienceTargetAsync(string audience, CancellationToken cancellationToken)
        {
            if (string.Equals(audience, "All Employees", StringComparison.OrdinalIgnoreCase))
            {
                return new AnnouncementTarget { TargetType = AnnouncementTargetType.AllGym };
            }

            var gyms = await _unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken);
            var gym = gyms.FirstOrDefault(g => string.Equals(g.Name.Trim(), audience, StringComparison.OrdinalIgnoreCase));
            if (gym is not null)
            {
                return new AnnouncementTarget { TargetType = AnnouncementTargetType.AllGym, GymId = gym.Id };
            }

            // "Trainers only" (or any other label) fans out to everyone — the portal has
            // no position-based targeting column; the audience label is preserved on the card.
            return new AnnouncementTarget { TargetType = AnnouncementTargetType.AllGym };
        }

        /// <summary>Active, non-archived users in the announcement's audience.</summary>
        private async Task<IReadOnlyList<User>> ResolveAudienceUsersAsync(AnnouncementTarget target, CancellationToken cancellationToken)
        {
            var users = (await _unitOfWork.GetRepository<User, int>().GetAllAsync(new ActiveUsersSpec(), cancellationToken)).ToList();
            if (target.GymId is not int gymId)
            {
                return users;
            }

            var members = new List<User>();
            foreach (var user in users)
            {
                if (await _userAccess.HasGymAccessAsync(user.Id, gymId, cancellationToken))
                {
                    members.Add(user);
                }
            }

            return members;
        }

        private async Task<List<AnnouncementItem>> BuildItemsAsync(IEnumerable<Announcement> rows, CancellationToken cancellationToken)
        {
            var items = new List<AnnouncementItem>();
            foreach (var announcement in rows)
            {
                var audienceLabel = await DescribeAudienceAsync(announcement, cancellationToken);
                var (read, total) = await ReadRateAsync(announcement, cancellationToken);
                items.Add(new AnnouncementItem
                {
                    Id = announcement.Id,
                    Title = announcement.Title,
                    Audience = audienceLabel,
                    SentDate = announcement.SentAt,
                    Status = announcement.Status.ToString(),
                    ReadRate = total > 0 ? Math.Round(read * 100m / total, 1) : 0m,
                    Message = announcement.Body,
                });
            }

            return items;
        }

        private async Task<string> DescribeAudienceAsync(Announcement announcement, CancellationToken cancellationToken)
        {
            var target = announcement.Targets.FirstOrDefault();
            if (target?.GymId is int gymId)
            {
                var gym = await _unitOfWork.GetRepository<Gym, int>().GetByIdAsync(gymId, cancellationToken);
                if (gym is not null)
                {
                    return gym.Name;
                }
            }

            return "All Employees";
        }

        private async Task<(int Read, int Total)> ReadRateAsync(Announcement announcement, CancellationToken cancellationToken)
        {
            if (announcement.Status != AnnouncementStatus.Sent || announcement.SentAt is null)
            {
                return (0, 0);
            }

            var delivered = (await _unitOfWork.GetRepository<Notification, int>()
                .GetAllAsync(new NotificationsByTitleSpec($"Announcement: {announcement.Title}"), cancellationToken)).ToList();
            var total = delivered.Count;
            var read = delivered.Count(n => n.IsRead);
            return (read, total);
        }
    }

    /// <summary>Account settings (mock §12): notification preferences and password.</summary>
    public class AccountSettingsService(
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IMapper mapper) : IAccountSettingsService
    {
        public async Task<NotificationPreferenceDto> GetPreferencesAsync(int userId, CancellationToken cancellationToken = default)
        {
            var preference = await LoadAsync(userId, createIfMissing: false, cancellationToken);
            return mapper.Map<NotificationPreferenceDto>(preference);
        }

        public async Task<NotificationPreferenceDto> UpdatePreferencesAsync(
            int userId, NotificationPreferenceDto preferences, CancellationToken cancellationToken = default)
        {
            var preference = await LoadAsync(userId, createIfMissing: true, cancellationToken);

            preference.Requests = preferences.Requests;
            preference.Attendance = preferences.Attendance;
            preference.Recruitment = preferences.Recruitment;
            preference.Management = preferences.Management;
            preference.Announcements = preferences.Announcements;

            unitOfWork.GetRepository<UserNotificationPreference, int>().Update(preference);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return mapper.Map<NotificationPreferenceDto>(preference);
        }

        public async Task ChangePasswordAsync(int userId, ChangePasswordRequestDto request, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            {
                throw new BadRequestException("The new password must be at least 8 characters.");
            }

            var user = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserByIdSpec(userId), cancellationToken)
                ?? throw new UnAuthorizedException("Your session is invalid. Please sign in again.");

            if (!passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
            {
                throw new UnAuthorizedException("The current password is incorrect.");
            }

            user.PasswordHash = passwordHasher.Hash(request.NewPassword);
            unitOfWork.GetRepository<User, int>().Update(user);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        private async Task<UserNotificationPreference> LoadAsync(int userId, bool createIfMissing, CancellationToken cancellationToken)
        {
            var user = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserByIdSpec(userId), cancellationToken)
                ?? throw new UnAuthorizedException("Your session is invalid. Please sign in again.");

            var existing = await unitOfWork.GetRepository<UserNotificationPreference, int>()
                .GetByIdAsync(new UserNotificationPreferenceByUserSpec(userId), cancellationToken);
            if (existing is not null || !createIfMissing)
            {
                return existing ?? new UserNotificationPreference { UserId = userId };
            }

            var preference = new UserNotificationPreference { UserId = userId };
            await unitOfWork.GetRepository<UserNotificationPreference, int>().AddAsync(preference, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return preference;
        }
    }
}
