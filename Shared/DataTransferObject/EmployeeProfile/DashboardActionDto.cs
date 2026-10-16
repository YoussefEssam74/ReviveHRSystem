namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class DashboardActionDto
{
    public string Title { get; init; } = string.Empty;
    public string Detail { get; init; } = string.Empty;
    public bool Urgent { get; init; }
}
