namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>The published schedule of an employee for a month (mock §7).</summary>
public sealed class EmployeeScheduleDto
{
    public string Month { get; init; } = string.Empty;
    public IReadOnlyList<ScheduleCycleDto> Cycles { get; init; } = Array.Empty<ScheduleCycleDto>();
    public IReadOnlyList<ScheduleDayDto> Days { get; init; } = Array.Empty<ScheduleDayDto>();
}
