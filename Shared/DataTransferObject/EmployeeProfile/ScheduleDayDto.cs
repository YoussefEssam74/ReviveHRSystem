namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A published schedule day for the employee (mock §7).</summary>
public sealed class ScheduleDayDto
{
    public DateOnly Date { get; init; }
    public string DayName { get; init; } = string.Empty;
    public string? ShiftName { get; init; }
    public TimeOnly? Start { get; init; }
    public TimeOnly? End { get; init; }
    public bool IsOff { get; init; }
    public bool IsToday { get; init; }
}
