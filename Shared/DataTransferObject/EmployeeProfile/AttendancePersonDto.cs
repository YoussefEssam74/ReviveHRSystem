namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class AttendancePersonDto
{
    public int EmployeeId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Position { get; init; } = string.Empty;
    public TimeOnly? CheckIn { get; init; }
    public int? LateMinutes { get; init; }
}
