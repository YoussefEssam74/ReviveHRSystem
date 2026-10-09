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
    /// <summary>Result for this event: ON_SCHEDULE, LATE, or EARLY_CHECKOUT.</summary>
    public string ShiftComparison { get; init; } = "ON_SCHEDULE";
}
