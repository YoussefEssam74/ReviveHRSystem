using Shared.DataTransferObject.Attendance;
using Shared.DataTransferObject.Kiosk;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Attendance station (kiosk) API. Callers redeem a short-lived 6-digit enrollment
    /// code at kiosk login to obtain a DB-backed station session token; event requests
    /// must present that token (or a gym-scoped user token). No deviceId anywhere —
    /// replacing broken station hardware cannot break the integration.
    /// </summary>
    public interface IAttendanceService
    {
        /// <summary>
        /// Station login: validates the 6-digit enrollment code (active and unexpired)
        /// and returns the gym context plus an opaque station session token.
        /// </summary>
        Task<StationLoginResponse> StationLoginAsync(StationLoginRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// Records a biometric check-in/check-out event after ADR-004 cross-gym validation.
        /// <paramref name="authorizedGymId"/> is the gym derived from the validated station
        /// session (or the gym-scoped user token); null means the request carries no
        /// gym-bound credential and is rejected. <paramref name="stationSessionId"/> is
        /// the session that issued the event (stored on the record for audit).
        /// An AUTO event that resolves to check-out returns null instead of recording
        /// when <paramref name="confirmCheckout"/> is false - the kiosk asks the employee
        /// first and re-sends the scan with confirmation. The /events endpoint passes
        /// true (integration callers decide for themselves); face-scan forwards the
        /// kiosk's confirm flag.
        /// </summary>
        Task<AttendanceResponse?> RecordBiometricEventAsync(AttendanceEventRequest request, int? authorizedGymId = null, int? stationSessionId = null, string? ipAddress = null, bool confirmCheckout = true, CancellationToken cancellationToken = default);

        /// <summary>
        /// Records a manual check-in/check-out (Face ID fallback) after ADR-004
        /// cross-gym validation; the reason is audited with the attendance change.
        /// </summary>
        Task<AttendanceResponse> RecordManualEntryAsync(ManualAttendanceRequest request, int? authorizedGymId = null, int? stationSessionId = null, string? ipAddress = null, CancellationToken cancellationToken = default);

        /// <summary>
        /// Today's counters and most recent events for one gym, as shown on the
        /// attendance station dashboard. The GymId comes from the validated station
        /// session (or a gym-scoped user token) - never from client input.
        /// </summary>
        Task<StationSummaryResponse> GetStationSummaryAsync(int gymId, CancellationToken cancellationToken = default);
    }
}
