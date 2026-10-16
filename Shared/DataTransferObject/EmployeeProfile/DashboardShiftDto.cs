namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class DashboardShiftDto
{
    public string ShiftName { get; init; } = string.Empty;
    public TimeOnly Start { get; init; }
    public TimeOnly End { get; init; }
}
