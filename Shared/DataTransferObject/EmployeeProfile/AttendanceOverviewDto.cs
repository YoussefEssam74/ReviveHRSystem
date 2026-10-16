namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Attendance overview for one month (mock §6).</summary>
public sealed class AttendanceOverviewDto
{
    public AttendanceSummaryDto Summary { get; init; } = new();
    public AttendanceRecordDto? Today { get; init; }
    public IReadOnlyList<AttendanceRecordDto> Records { get; init; } = Array.Empty<AttendanceRecordDto>();
}
