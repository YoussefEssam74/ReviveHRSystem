namespace DomainLayer.Models.AttendanceModule.Enums
{
    /// <summary>
    /// Identifies the verification method used for check-in or check-out.
    /// Biometric (Face-ID recognition at attendance station), Manual (entered by authorized HR/manager).
    /// </summary>
    public enum AttendanceMethod
    {
        Biometric = 1,
        Manual = 2
    }
}
