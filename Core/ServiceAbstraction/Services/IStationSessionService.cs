using DomainLayer.Models.AttendanceModule;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Lifecycle of station (kiosk) sessions: an enrollment code is redeemed once at
    /// kiosk login and exchanged for an opaque, DB-backed session token. The token
    /// is generated with a cryptographically secure RNG, only its SHA-256 hash is
    /// stored, and the GymId is always derived from the stored session — never from
    /// client input. Sessions expire and can be revoked by HR.
    /// </summary>
    public interface IStationSessionService
    {
        /// <summary>Lifetime applied to new sessions (from StationSession:LifetimeHours).</summary>
        TimeSpan SessionLifetime { get; }

        /// <summary>
        /// Creates a live session for the gym and returns the plaintext token
        /// (shown to the station exactly once — it is never stored or recoverable).
        /// </summary>
        Task<string> CreateSessionAsync(int gymId, int? stationCodeId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Resolves a live session from a plaintext token. Returns null when the token
        /// is unknown, the session expired, it was revoked, or its gym is inactive.
        /// </summary>
        Task<StationSession?> ValidateSessionAsync(string sessionToken, CancellationToken cancellationToken = default);

        /// <summary>Revokes every live session of the gym and returns how many were revoked.</summary>
        Task<int> RevokeGymSessionsAsync(int gymId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Revokes a single station session by id (kiosk logout). Returns false when
        /// the session does not exist; already-revoked or expired sessions are a no-op.
        /// </summary>
        Task<bool> RevokeSessionAsync(int stationSessionId, CancellationToken cancellationToken = default);
    }
}
