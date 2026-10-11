namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Branch/team attendance day view (mock §22 Attendance Management).</summary>
public sealed class AttendanceManagementDto
{
    public DateOnly Date { get; init; }
    public AttendanceCountsDto Summary { get; init; } = new();
    public IReadOnlyList<AttendancePersonDto> Late { get; init; } = Array.Empty<AttendancePersonDto>();
    public IReadOnlyList<AttendancePersonDto> Absent { get; init; } = Array.Empty<AttendancePersonDto>();
    public IReadOnlyList<AttendancePersonDto> MissingCheckout { get; init; } = Array.Empty<AttendancePersonDto>();
}
