namespace DomainLayer.Models.AttendanceModule.Enums
{
    /// <summary>
    /// Represents the online/active status of a physical biometric Face-ID kiosk station.
    /// Active (station accepting clock-in/out), Inactive (offline / maintenance).
    /// </summary>
    public enum BiometricDeviceStatus
    {
        Active = 1,
        Inactive = 2
    }
}
