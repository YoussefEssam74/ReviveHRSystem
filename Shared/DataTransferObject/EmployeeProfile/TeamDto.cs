namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A team the caller leads or belongs to (mock §13 My Team scope).</summary>
public sealed class TeamDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int GymId { get; init; }
    public int MemberCount { get; init; }
}
