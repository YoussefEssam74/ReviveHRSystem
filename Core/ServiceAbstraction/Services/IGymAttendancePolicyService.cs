using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// HR-editable attendance policy of a gym. The only setting for now is the monthly
    /// cap of excused Late Attendance / Early Leave hours — HR decides the number once and
    /// it is static for every employee of the gym.
    /// </summary>
    public interface IGymAttendancePolicyService
    {
        Task<AttendancePolicyDto> GetAsync(
            int actorUserId, int gymId, int? activeGymId, CancellationToken cancellationToken = default);

        Task<AttendancePolicyDto> UpdateAsync(
            int actorUserId, int gymId, UpdateAttendancePolicyDto update, int? activeGymId, CancellationToken cancellationToken = default);
    }
}
