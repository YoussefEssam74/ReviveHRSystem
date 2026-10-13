using Shared;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Notifications inbox (mock §11): bell list, unread count, mark read (one or all).
    /// </summary>
    public interface INotificationService
    {
        Task<PaginationResult<NotificationDto>> GetNotificationsAsync(
            int userId, int? activeGymId, NotificationQueryParams query, CancellationToken cancellationToken = default);

        Task<int> GetUnreadCountAsync(int userId, int? activeGymId, CancellationToken cancellationToken = default);

        Task MarkReadAsync(int userId, int notificationId, CancellationToken cancellationToken = default);

        Task MarkAllReadAsync(int userId, CancellationToken cancellationToken = default);
    }

    /// <summary>Account settings: notification preferences and password change (mock §12).</summary>
    public interface IAccountSettingsService
    {
        Task<NotificationPreferenceDto> GetPreferencesAsync(int userId, CancellationToken cancellationToken = default);

        Task<NotificationPreferenceDto> UpdatePreferencesAsync(
            int userId, NotificationPreferenceDto preferences, CancellationToken cancellationToken = default);

        Task ChangePasswordAsync(int userId, ChangePasswordRequestDto request, CancellationToken cancellationToken = default);
    }
}
