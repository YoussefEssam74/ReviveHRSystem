namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class AttendanceCountsDto
{
    public int Present { get; init; }
    public int Late { get; init; }
    public int Absent { get; init; }
    public int MissingCheckout { get; init; }
}
