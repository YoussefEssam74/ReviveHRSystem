namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class TeamMemberDayDto
{
    public int EmployeeId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Position { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public TimeOnly? CheckIn { get; init; }
    public string Initials { get; init; } = string.Empty;
    public string? ShiftName { get; init; }
    public TimeOnly? ShiftStart { get; init; }
    public TimeOnly? ShiftEnd { get; init; }
    public bool IsOff { get; init; }
}
