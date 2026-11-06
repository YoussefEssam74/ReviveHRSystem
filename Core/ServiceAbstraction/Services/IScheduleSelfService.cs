using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>Published-schedule reads for one employee (mock §7 My Schedule).</summary>
    public interface IScheduleSelfService
    {
        /// <summary>
        /// Published schedule of one employee. The window is either an explicit
        /// <paramref name="from"/>/<paramref name="to"/> range (yyyy-MM-dd, inclusive —
        /// used by the profile's current-week tab so a week that straddles a month
        /// boundary still resolves its cycles) or the calendar
        /// <paramref name="month"/> (yyyy-MM, default: the organization's current month).
        /// </summary>
        Task<EmployeeScheduleDto> GetScheduleAsync(
            int actorUserId,
            int employeeId,
            string? month,
            string? from,
            string? to,
            int? activeGymId,
            CancellationToken cancellationToken = default);
    }
}
