namespace DomainLayer.Models.AttendanceModule.Enums
{
    /// <summary>
    /// Represents the evaluated attendance status evaluated against scheduled shift templates.
    /// OnTime, Late (arrived past grace period), Absent (no check-in), EarlyCheckout, MissingCheckout (clocked in without clocking out).
    /// Off (S4): scheduled off / approved day off / on leave — persisted when HR writes a
    /// record manually or corrects one to an off day (the UI also derives Off/Scheduled
    /// rows for days with no stored record).
    /// </summary>
    public enum AttendanceStatus
    {
        OnTime = 1,
        Late = 2,
        Absent = 3,
        EarlyCheckout = 4,
        MissingCheckout = 5,
        Off = 6
    }
}
