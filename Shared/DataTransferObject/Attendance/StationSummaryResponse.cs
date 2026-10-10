namespace Shared.DataTransferObject.Attendance;

/// <summary>
/// Live view of a station's gym for the kiosk dashboard: today's counters and the
/// most recent attendance events. Authenticated by the station session, so the
/// GymId always comes from the validated session.
/// </summary>
public sealed class StationSummaryResponse
{
    /// <summary>Employees with a check-in recorded today at this gym.</summary>
    public int PresentCount { get; init; }

    /// <summary>Employees scheduled with a real shift at this gym today.</summary>
    public int ScheduledTodayCount { get; init; }

    /// <summary>Most recent attendance events at this gym, newest first.</summary>
    public IReadOnlyList<StationSummaryRecord> Records { get; init; } = Array.Empty<StationSummaryRecord>();
}

/// <summary>One row of the kiosk dashboard feed.</summary>
public sealed class StationSummaryRecord
{
    public string RecordId { get; init; } = string.Empty;
    public string EmployeeId { get; init; } = string.Empty;
    public string EmployeeName { get; init; } = string.Empty;

    /// <summary>PRESENT, LEFT, or DAY_OFF for this employee today.</summary>
    public string Status { get; init; } = string.Empty;

    /// <summary>Direction of the most recent punch today (IN, OUT), or null when none.</summary>
    public string? LastEventType { get; init; }

    public DateTime? LastEventTime { get; init; }
    public string? AttendanceStatus { get; init; }
    public string? Method { get; init; }
}