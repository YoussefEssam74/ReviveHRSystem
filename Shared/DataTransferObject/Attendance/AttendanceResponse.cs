namespace Shared.DataTransferObject.Attendance;

/// <summary>Accepted attendance event.</summary>
public sealed class AttendanceResponse
{
    public string RecordId { get; init; } = string.Empty;
    public string EmployeeId { get; init; } = string.Empty;
    public string EmployeeName { get; init; } = string.Empty;
    public int GymId { get; init; }
    public string GymName { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Method { get; init; } = string.Empty;
    /// <summary>Accepted event instant, normalized to UTC.</summary>
    public DateTime Timestamp { get; init; }
    /// <summary>Current record status: ONTIME, LATE, or EARLYCHECKOUT.</summary>
    public string AttendanceStatus { get; init; } = string.Empty;
    /// <summary>
    /// Result for this event: ON_SCHEDULE, LATE, EARLY_LEAVE (warning raised) or
    /// EARLY_LEAVE_COVERED (a pending/approved Early Leave request covers it).
    /// The configured late/early-leave grace windows decide when the boundary is crossed.
    /// </summary>
    public string ShiftComparison { get; init; } = "ON_SCHEDULE";
    /// <summary>Minutes the check-out ran before the shift end (0 when not early).</summary>
    public int EarlyLeaveMinutes { get; init; }
    /// <summary>True when the departure raised a warning for the Branch Manager and HR.</summary>
    public bool EarlyLeaveWarning { get; init; }
}
