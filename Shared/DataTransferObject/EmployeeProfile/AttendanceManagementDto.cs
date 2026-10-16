namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>
/// Branch/team attendance day view (mock §22 Attendance Management).
/// <see cref="Late"/>, <see cref="Absent"/> and <see cref="MissingCheckout"/> are the
/// exception lists the page renders; <see cref="Roster"/> is the paged, filterable
/// view of every in-scope person-day over the requested day or range.
/// </summary>
public sealed class AttendanceManagementDto
{
    /// <summary>Single requested day; the first day of the range when one was supplied.</summary>
    public DateOnly Date { get; init; }

    /// <summary>First day of the requested window.</summary>
    public DateOnly DateFrom { get; init; }

    /// <summary>Last day of the requested window (equals <see cref="Date"/> for a single day).</summary>
    public DateOnly DateTo { get; init; }

    public AttendanceCountsDto Summary { get; init; } = new();
    public IReadOnlyList<AttendancePersonDto> Late { get; init; } = Array.Empty<AttendancePersonDto>();
    public IReadOnlyList<AttendancePersonDto> Absent { get; init; } = Array.Empty<AttendancePersonDto>();
    public IReadOnlyList<AttendancePersonDto> MissingCheckout { get; init; } = Array.Empty<AttendancePersonDto>();

    /// <summary>Paged roster of in-scope attendance rows for the window.</summary>
    public PaginationResult<AttendancePersonDto> Roster { get; init; } = null!;
}
