using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Self-service attendance and leave balance (mock §6 My Attendance).
    /// Corrections are never direct edits: they go through the request workflow
    /// (roles guide §7), so this surface is read-only plus request creation.
    /// </summary>
    public interface IAttendanceSelfService
    {
        Task<AttendanceOverviewDto> GetAttendanceAsync(
            int actorUserId, int employeeId, string? month, int? activeGymId, CancellationToken cancellationToken = default);

        Task<LeaveBalanceOverviewDto> GetLeaveBalanceAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);
    }
}
