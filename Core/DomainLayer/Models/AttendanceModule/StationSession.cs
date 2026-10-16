using DomainLayer.Models.OrganizationModule;

namespace DomainLayer.Models.AttendanceModule
{
    /// <summary>
    /// A station (kiosk) session created by redeeming a short-lived 6-digit station
    /// enrollment code at POST /api/kiosk/login. The session token is an opaque,
    /// cryptographically random secret shown to the station only once — only its
    /// SHA-256 hash is stored here. Attendance requests authenticate with that token,
    /// and the GymId is always read from this record (never from client input), which
    /// gives tenant isolation plus a full audit trail of which session issued each
    /// attendance record. Sessions expire and can be revoked by HR; a rotated code
    /// never kills sessions that are already enrolled.
    /// </summary>
    public class StationSession : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        /// <summary>
        /// The enrollment code this session was issued from (audit trail only — the
        /// plaintext code is never stored on attendance records).
        /// </summary>
        public int? StationCodeId { get; set; }
        public virtual StationCode? StationCode { get; set; }

        /// <summary>SHA-256 hash of the session token; the plaintext exists only in the kiosk login response.</summary>
        public string TokenHash { get; set; } = string.Empty;

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        /// <summary>When the session stops being accepted (UTC).</summary>
        public DateTime ExpiresAtUtc { get; set; }

        /// <summary>When HR revoked the session (UTC); null while live.</summary>
        public DateTime? RevokedAtUtc { get; set; }
    }
}
