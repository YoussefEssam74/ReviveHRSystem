namespace Service.Services
{
    /// <summary>
    /// Organization attendance policy from the "Attendance" configuration section.
    /// The grace windows decide when a punch is actually late or an early leave: a
    /// check-out inside <see cref="EarlyLeaveGraceMinutes"/> of the shift end is an
    /// ordinary departure, not an Early Leaving warning.
    /// </summary>
    public sealed class AttendanceOptions
    {
        public const int DefaultLateGraceMinutes = 15;
        public const int DefaultEarlyLeaveGraceMinutes = 10;

        public int LateGraceMinutes { get; init; } = DefaultLateGraceMinutes;

        public int EarlyLeaveGraceMinutes { get; init; } = DefaultEarlyLeaveGraceMinutes;
    }
}
