namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A published schedule day for the employee (mock §7). The dashboard's
/// 7-day strip also carries the day's attendance clock times when a record exists.</summary>
public sealed class ScheduleDayDto
{
    public DateOnly Date { get; init; }
    public string DayName { get; init; } = string.Empty;
    public string? ShiftName { get; init; }
    public TimeOnly? Start { get; init; }
    public TimeOnly? End { get; init; }
    public bool IsOff { get; init; }
    public bool IsToday { get; init; }

    /// <summary>Clock-in time of that day's attendance record (dashboard strip only; null when absent or off days).</summary>
    public TimeOnly? CheckIn { get; init; }

    /// <summary>Clock-out time of that day's attendance record (dashboard strip only).</summary>
    public TimeOnly? CheckOut { get; init; }
}
