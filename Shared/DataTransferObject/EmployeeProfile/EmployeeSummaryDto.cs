namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Directory row (mock §21 Employees).</summary>
public sealed class EmployeeSummaryDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Position { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string Initials { get; init; } = string.Empty;
    public string? TodayShiftName { get; init; }
    public TimeOnly? TodayShiftStart { get; init; }
    public TimeOnly? TodayShiftEnd { get; init; }
}
