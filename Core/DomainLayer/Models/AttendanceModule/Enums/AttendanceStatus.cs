namespace DomainLayer.Models.AttendanceModule.Enums
{
    /// <summary>
    /// Represents the evaluated attendance status evaluated against scheduled shift templates.
    /// OnTime, Late (arrived past grace period), Absent (no check-in), EarlyCheckout, MissingCheckout (clocked in without clocking out).
    /// </summary>
    public enum AttendanceStatus
    {
        OnTime = 1,
        Late = 2,
        Absent = 3,
        EarlyCheckout = 4,
        MissingCheckout = 5
    }
}
