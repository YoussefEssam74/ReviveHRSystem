namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class ScheduleCycleDto
{
    public int Id { get; init; }
    public DateOnly Start { get; init; }
    public DateOnly End { get; init; }
    public string Status { get; init; } = string.Empty;
}
