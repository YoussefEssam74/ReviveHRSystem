using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.OrganizationModule;

namespace DomainLayer.Models.AttendanceModule
{
    /// <summary>
    /// Represents an on-premise Face-ID biometric kiosk terminal installed at a specific gym.
    /// Stores the unique DeviceToken used by the kiosk client to authenticate events and determine the GymId scope.
    /// </summary>
    public class BiometricDevice : BaseEntity
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public string DeviceToken { get; set; } = string.Empty;
        public string? Vendor { get; set; }
        public BiometricDeviceStatus Status { get; set; } = BiometricDeviceStatus.Active;
    }
}
