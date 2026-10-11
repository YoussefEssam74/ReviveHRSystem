namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Role-specific strip: team scope for Team Leaders, gym scope for Branch Managers.</summary>
public sealed class DashboardOverviewDto
{
    public string Scope { get; init; } = string.Empty;
    public int MemberCount { get; init; }
    public int PresentToday { get; init; }
    public int PendingRequests { get; init; }
    public int Absent { get; init; }
}
