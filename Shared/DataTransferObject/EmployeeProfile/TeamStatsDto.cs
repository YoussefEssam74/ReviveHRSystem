namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class TeamStatsDto
{
    public int Total { get; init; }
    public int Present { get; init; }
    public int Late { get; init; }
    public int Absent { get; init; }
    public int PendingRequests { get; init; }
}
