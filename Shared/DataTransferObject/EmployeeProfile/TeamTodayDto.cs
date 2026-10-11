namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Team-day overview (mock §13 My Team).</summary>
public sealed class TeamTodayDto
{
    public int TeamId { get; init; }
    public string TeamName { get; init; } = string.Empty;
    public TeamStatsDto Stats { get; init; } = new();
    public IReadOnlyList<TeamMemberDayDto> Members { get; init; } = Array.Empty<TeamMemberDayDto>();
}
