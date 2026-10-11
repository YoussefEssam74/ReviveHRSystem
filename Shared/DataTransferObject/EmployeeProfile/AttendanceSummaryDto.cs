namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class AttendanceSummaryDto
{
    public int Rate { get; init; }
    public int Present { get; init; }
    public int Late { get; init; }
    public int Absent { get; init; }
    public int EarlyCheckout { get; init; }
    public int MissingCheckout { get; init; }
}
