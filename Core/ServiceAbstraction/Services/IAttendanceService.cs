using Shared.DataTransferObject.Attendance;
using Shared.DataTransferObject.Kiosk;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Attendance station (kiosk) API. Callers present the 6-digit station code at
    /// kiosk login to receive a station JWT bound to the resolved gym; event requests
    /// must then present that token. No deviceId anywhere — replacing broken station
    /// hardware cannot break the integration.
    /// </summary>
    public interface IAttendanceService
    {
        /// <summary>Station login: validates the 6-digit code and returns the gym context plus a station token.</summary>
        Task<StationLoginResponse> StationLoginAsync(StationLoginRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// Records a biometric check-in/check-out event after station-gym binding and
        /// ADR-004 cross-gym validation. <paramref name="authorizedGymId"/> is the gymId
        /// claim of the caller's token — null (no gym binding) or a mismatching gym is rejected.
        /// </summary>
        Task<AttendanceResponse> RecordBiometricEventAsync(AttendanceEventRequest request, int? authorizedGymId = null, string? ipAddress = null, CancellationToken cancellationToken = default);

        /// <summary>
        /// Records a manual check-in/check-out (Face ID fallback) after station-gym
        /// binding and ADR-004 cross-gym validation.
        /// </summary>
        Task<AttendanceResponse> RecordManualEntryAsync(ManualAttendanceRequest request, int? authorizedGymId = null, string? ipAddress = null, CancellationToken cancellationToken = default);
    }
}
