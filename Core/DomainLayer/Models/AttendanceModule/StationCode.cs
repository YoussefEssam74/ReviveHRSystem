using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.AttendanceModule
{
    /// <summary>
    /// The gym's shared 6-digit station credential used by attendance stations (kiosks).
    /// Replaces the per-device DeviceToken/DeviceId model: every station request carries
    /// this code and the gym is resolved from it, so replacing broken hardware only
    /// requires re-entering the same code — no device-bound secret can fail.
    /// One active code per gym; HR rotates it, which immediately invalidates the old code.
    /// </summary>
    public class StationCode : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        /// <summary>Exactly 6 digits.</summary>
        public string Code { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

        /// <summary>User who generated (rotated) this code — audit trail.</summary>
        public int? GeneratedBy { get; set; }
        public virtual User? Generator { get; set; }
    }
}
