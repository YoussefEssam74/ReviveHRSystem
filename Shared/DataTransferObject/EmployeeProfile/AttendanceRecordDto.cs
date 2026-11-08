namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>One attendance row (mock §6).</summary>
public sealed class AttendanceRecordDto
{
    public DateOnly Date { get; init; }
    public string Shift { get; init; } = string.Empty;
    public string ShiftName { get; init; } = string.Empty;
    public TimeOnly? CheckIn { get; init; }
    public TimeOnly? CheckOut { get; init; }
    public string Status { get; init; } = string.Empty;
    public string Source { get; init; } = string.Empty;
    public string? Notes { get; init; }

    /// <summary>Approved cover/extra days for an unscheduled punch (1 or 2), else null.
    /// Display-only: never affects the monthly day-off (leave) balance.</summary>
    public int? CoverDays { get; init; }
}
