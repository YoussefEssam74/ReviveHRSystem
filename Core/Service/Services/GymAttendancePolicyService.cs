using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.OrganizationModule;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Reads and updates the gym attendance policy. The active gym of the token must be
    /// the gym being read or written, so a caller can never tune another gym's policy,
    /// and the caller must be one of the gym's policy managers (Branch Manager or one
    /// of the HR roles; Team Leaders carry attendance.view only, so their read comes
    /// from the portals' aggregates — never from this raw policy surface).
    /// </summary>
    public class GymAttendancePolicyService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess,
        IMapper mapper) : IGymAttendancePolicyService
    {
        private const decimal MaxCapHours = 200m;

        private static readonly string[] PolicyManagerRoleNames =
        [
            Shared.Authorization.RoleNames.BranchManager,
            Shared.Authorization.RoleNames.Hr,
            Shared.Authorization.RoleNames.HrManager,
            Shared.Authorization.RoleNames.SuperAdmin,
        ];

        public async Task<AttendancePolicyDto> GetAsync(
            int actorUserId, int gymId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gym = await LoadInActiveGymAsync(gymId, activeGymId, cancellationToken);
            await EnsurePolicyManagerAsync(actorUserId, gymId, cancellationToken);
            return mapper.Map<AttendancePolicyDto>(gym);
        }

        public async Task<AttendancePolicyDto> UpdateAsync(
            int actorUserId, int gymId, UpdateAttendancePolicyDto update, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gym = await LoadInActiveGymAsync(gymId, activeGymId, cancellationToken);
            await EnsurePolicyManagerAsync(actorUserId, gymId, cancellationToken);

            var cap = update.ExcusedLateHoursCapPerMonth;
            if (cap < 0 || cap > MaxCapHours)
            {
                throw new BadRequestException(
                    $"The monthly excused-hours cap must be between 0 and {MaxCapHours} hours.");
            }

            gym.ExcusedLateHoursCapPerMonth = cap;
            unitOfWork.GetRepository<Gym, int>().Update(gym);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return mapper.Map<AttendancePolicyDto>(gym);
        }

        private async Task EnsurePolicyManagerAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var roleNames = await userAccess.GetGymRoleNamesAsync(actorUserId, gymId, cancellationToken);
            if (!roleNames.Any(PolicyManagerRoleNames.Contains))
            {
                throw new NotFoundException("Gym not found.");
            }
        }

        private async Task<Gym> LoadInActiveGymAsync(int gymId, int? activeGymId, CancellationToken cancellationToken)
        {
            if (activeGymId is null || activeGymId.Value != gymId)
            {
                // A null or mismatched active gym is a scope failure, answered the same
                // way as a missing gym so the API never confirms another gym's data.
                throw new NotFoundException("Gym not found.");
            }

            return await unitOfWork.GetRepository<Gym, int>().GetByIdAsync(gymId, cancellationToken)
                ?? throw new NotFoundException("Gym not found.");
        }
    }
}
