using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.UserModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;

namespace Service.Services
{
    /// <summary>Notifications inbox for the signed-in user (mock §11).</summary>
    public class NotificationService(
        IUnitOfWork unitOfWork,
        IMapper mapper) : INotificationService
    {
        public async Task<PaginationResult<NotificationDto>> GetNotificationsAsync(
            int userId, int? activeGymId, NotificationQueryParams query, CancellationToken cancellationToken = default)
        {
            var notifications = (await unitOfWork.GetRepository<Notification, int>()
                .GetAllAsync(new NotificationsByUserSpec(userId, query.UnreadOnly), cancellationToken)).ToList();

            var page = notifications
                .Skip(query.SkipCount)
                .Take(query.PageSize)
                .Select(n => mapper.Map<NotificationDto>(n))
                .ToList();

            return new PaginationResult<NotificationDto>(query.PageNumber, query.PageSize, notifications.Count, page);
        }

        public async Task<int> GetUnreadCountAsync(int userId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            return await unitOfWork.GetRepository<Notification, int>()
                .CountAsync(new UnreadNotificationsByUserSpec(userId), cancellationToken);
        }

        public async Task MarkReadAsync(int userId, int notificationId, CancellationToken cancellationToken = default)
        {
            var notification = await unitOfWork.GetRepository<Notification, int>()
                .GetByIdAsync(notificationId, cancellationToken)
                ?? throw new NotFoundException("Notification not found.");

            if (notification.UserId != userId)
            {
                throw new NotFoundException("Notification not found.");
            }

            if (notification.IsRead)
            {
                return;
            }

            notification.IsRead = true;
            unitOfWork.GetRepository<Notification, int>().Update(notification);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        public async Task MarkAllReadAsync(int userId, CancellationToken cancellationToken = default)
        {
            var notifications = await unitOfWork.GetRepository<Notification, int>()
                .GetAllAsync(new NotificationsByUserSpec(userId), cancellationToken);

            var repository = unitOfWork.GetRepository<Notification, int>();
            foreach (var notification in notifications.Where(n => !n.IsRead))
            {
                notification.IsRead = true;
                repository.Update(notification);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
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
