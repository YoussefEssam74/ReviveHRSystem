namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class AttendanceSummaryDto
{
    public int Rate { get; init; }
    public int Present { get; init; }
    public int Late { get; init; }
    public int Absent { get; init; }
    public int EarlyCheckout { get; init; }
    public int MissingCheckout { get; init; }

    /// <summary>Total approved cover/extra days this month (display-only, separate
    /// from the leave/day-off balance).</summary>
    public int CoverDays { get; init; }
}
