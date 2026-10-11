using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>Published-schedule reads for one employee (mock §7 My Schedule).</summary>
    public interface IScheduleSelfService
    {
        Task<EmployeeScheduleDto> GetScheduleAsync(
            int actorUserId, int employeeId, string? month, int? activeGymId, CancellationToken cancellationToken = default);
    }
}
