namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class DashboardAttendanceDto
{
    public TimeOnly? CheckIn { get; init; }
    public TimeOnly? CheckOut { get; init; }
    public bool CheckedIn { get; init; }
    public string Status { get; init; } = string.Empty;
    public string Source { get; init; } = string.Empty;
}
