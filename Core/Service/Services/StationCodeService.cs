using System.Security.Cryptography;
using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Configuration;
using Shared.DataTransferObject.Gym;

namespace Service.Services
{
    /// <summary>
    /// HR-side management of a gym's station credentials.
    ///   Enrollment code: rotating issues a new short-lived code and immediately
    ///     deactivates the old one (old codes can no longer enroll anything).
    ///   Station sessions: revoking disconnects enrolled kiosks without touching
    ///     the codes, so a rotation never kicks a running station off the floor.
    /// Access is limited to TopManagement or HR users assigned to the target gym.
    /// </summary>
    public class StationCodeService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess,
        IStationSessionService stationSessions,
        IMapper mapper,
        StationCodeOptions options) : IStationCodeService
    {
        public async Task<StationCodeResponse> RotateAsync(int gymId, int? actorUserId, CancellationToken cancellationToken = default)
        {
            await EnsureCanManageStationCodesAsync(gymId, actorUserId, cancellationToken);

            var gymRepository = unitOfWork.GetRepository<Gym, int>();
            var gym = await gymRepository.GetByIdAsync(gymId, cancellationToken)
                ?? throw new NotFoundException("Gym not found.");

            if (gym.Status != GymStatus.Active)
            {
                throw new BadRequestException("Cannot generate a station code for an inactive gym.");
            }

            var codeRepository = unitOfWork.GetRepository<StationCode, int>();
            var generatedAt = DateTime.UtcNow;
            var expiresAtUtc = generatedAt.AddMinutes(options.ExpirationMinutes);
            StationCode station = null!;
            await unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                var activeCodes = await codeRepository.GetAllAsync(new ActiveStationCodeByGymSpec(gymId), cancellationToken);
                foreach (var activeCode in activeCodes)
                {
                    activeCode.IsActive = false;
                }

                // Persist deactivation before insert because the database enforces a
                // unique active-code index per gym.
                await unitOfWork.SaveChangesAsync(cancellationToken);
                station = new StationCode
                {
                    GymId = gymId,
                    Gym = gym,
                    Code = await GenerateUniqueCodeAsync(codeRepository, cancellationToken),
                    IsActive = true,
                    GeneratedAt = generatedAt,
                    ExpiresAtUtc = expiresAtUtc,
                    GeneratedBy = actorUserId
                };
                await codeRepository.AddAsync(station, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);

            return mapper.Map<StationCodeResponse>(station);
        }

        public async Task<StationCodeResponse> GetCurrentAsync(int gymId, int actorUserId, CancellationToken cancellationToken = default)
        {
            await EnsureCanManageStationCodesAsync(gymId, actorUserId, cancellationToken);

            var gym = await unitOfWork.GetRepository<Gym, int>().GetByIdAsync(gymId, cancellationToken)
                ?? throw new NotFoundException("Gym not found.");
            if (gym.Status != GymStatus.Active)
            {
                throw new BadRequestException("Cannot view a station code for an inactive gym.");
            }

            var codeRepository = unitOfWork.GetRepository<StationCode, int>();
            var activeCode = await codeRepository.GetByIdAsync(new ActiveStationCodeByGymSpec(gymId), cancellationToken)
                ?? throw new NotFoundException("This gym has no active station code. Generate one first.");

            return mapper.Map<StationCodeResponse>(activeCode);
        }

        /// <summary>
        /// Disconnects every enrolled kiosk of the gym. The authorization check is the
        /// same one protecting the enrollment codes, so no second rule is introduced.
        /// </summary>
        public async Task<int> RevokeStationSessionsAsync(int gymId, int? actorUserId, CancellationToken cancellationToken = default)
        {
            await EnsureCanManageStationCodesAsync(gymId, actorUserId, cancellationToken);

            var gym = await unitOfWork.GetRepository<Gym, int>().GetByIdAsync(gymId, cancellationToken)
                ?? throw new NotFoundException("Gym not found.");

            return await stationSessions.RevokeGymSessionsAsync(gym.Id, cancellationToken);
        }

        private async Task EnsureCanManageStationCodesAsync(int gymId, int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var actor = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserByIdSpec(actorUserId.Value), cancellationToken)
                ?? throw new UnAuthorizedException("Your session is invalid. Please sign in again.");

            if (!actor.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            if (actor.UserType == UserType.TopManagement)
            {
                return;
            }

            if (!await userAccess.HasGymAccessAsync(actorUserId.Value, gymId, cancellationToken))
            {
                throw new UnAuthorizedException("You do not have access to this gym.");
            }

            if (actor.UserType != UserType.HR)
            {
                throw new UnAuthorizedException("You are not allowed to manage station codes.");
            }
        }

        private static async Task<string> GenerateUniqueCodeAsync(IGenaricRepository<StationCode, int> codeRepository, CancellationToken cancellationToken)
        {
            // 6 digits → 1,000,000 combinations; collision chance per attempt ~0.1%.
            for (var attempt = 0; attempt < 10; attempt++)
            {
                var candidate = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
                var existing = await codeRepository.GetByIdAsync(new StationCodeExactSpec(candidate), cancellationToken);
                if (existing is null)
                {
                    return candidate;
                }
            }

            throw new BadRequestException("Could not generate a unique station code. Please retry.");
        }
    }
}
