namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Employee dashboard payload (mock §1 renderDashboard).</summary>
public sealed class EmployeeDashboardDto
{
    public string Greeting { get; init; } = string.Empty;
    public DashboardUserDto User { get; init; } = null!;
    public DashboardShiftDto? TodayShift { get; init; }
    public DashboardAttendanceDto? TodayAttendance { get; init; }
    public AttendanceSummaryDto MonthSummary { get; init; } = new();
    public IReadOnlyList<ScheduleDayDto> UpcomingSchedule { get; init; } = Array.Empty<ScheduleDayDto>();
    public int PendingRequestCount { get; init; }
    public PayrollEntryDto? LatestPayroll { get; init; }
    public IReadOnlyList<NotificationDto> RecentNotifications { get; init; } = Array.Empty<NotificationDto>();
    public IReadOnlyList<DashboardActionDto> ActionRequired { get; init; } = Array.Empty<DashboardActionDto>();
    public DashboardOverviewDto? Overview { get; init; }
}
