using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.AttendanceModule
{
    /// <summary>
    /// The gym's shared 6-digit station enrollment code used by attendance stations
    /// (kiosks) to obtain a station session. Replaces the per-device DeviceToken/
    /// DeviceId model: redeeming the code never depends on hardware identity, so a
    /// replaced PC only needs a fresh code.
    /// One active code per gym; HR rotates it, which immediately invalidates the old
    /// code. Rotated codes also stop being accepted after
    /// <see cref="ExpiresAtUtc"/> (StationCode:ExpirationMinutes).
    /// </summary>
    public class StationCode : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        /// <summary>Exactly 6 digits.</summary>
        public string Code { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// When this code stops being accepted (UTC). Null means it never expires —
        /// used by the development seeder so local/test codes stay usable, while
        /// HR-rotated codes get a short lifetime to limit brute-force exposure.
        /// </summary>
        public DateTime? ExpiresAtUtc { get; set; }

        /// <summary>User who generated (rotated) this code — audit trail.</summary>
        public int? GeneratedBy { get; set; }
        public virtual User? Generator { get; set; }
    }
}
