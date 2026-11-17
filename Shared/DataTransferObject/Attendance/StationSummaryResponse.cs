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

    /// <summary>
    /// Today's roster: every employee scheduled with a real shift at this gym,
    /// with shift times, punches, and lateness/early-leave minutes.
    /// </summary>
    public IReadOnlyList<StationSummaryRecord> Records { get; init; } = Array.Empty<StationSummaryRecord>();
}

/// <summary>One row of the kiosk dashboard roster: a scheduled employee and today's punches.</summary>
public sealed class StationSummaryRecord
{
    public string? RecordId { get; init; }
    public string EmployeeId { get; init; } = string.Empty;
    public string EmployeeName { get; init; } = string.Empty;

    /// <summary>SCHEDULED (shift not ended, no punch), PRESENT, LEFT, or ABSENT.</summary>
    public string Status { get; init; } = string.Empty;

    public string ShiftName { get; init; } = string.Empty;
    /// <summary>Shift start, "HH:mm" in the attendance timezone.</summary>
    public string ShiftStart { get; init; } = string.Empty;
    /// <summary>Shift end, "HH:mm" in the attendance timezone.</summary>
    public string ShiftEnd { get; init; } = string.Empty;

    /// <summary>Check-in time, "HH:mm" in the attendance timezone; null until the punch.</summary>
    public string? CheckIn { get; init; }
    /// <summary>Check-out time, "HH:mm" in the attendance timezone; null until the punch.</summary>
    public string? CheckOut { get; init; }

    /// <summary>Minutes checked in after the shift start (0 when on time or not in yet).</summary>
    public int LateMinutes { get; init; }

    /// <summary>Minutes the employee left before the shift end (0 when not early or still in).</summary>
    public int EarlyLeaveMinutes { get; init; }

    public string? Method { get; init; }
}