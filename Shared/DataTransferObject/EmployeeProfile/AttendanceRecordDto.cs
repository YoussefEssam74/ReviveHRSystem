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
}
