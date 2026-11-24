using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject;
using Shared.DataTransferObject.Gym;

namespace Service.Services
{
    /// <summary>
    /// Gym directory for the portal shell (GET /api/gyms): every active gym for
    /// Top Management, only the user's assigned gyms otherwise, each with its branch
    /// location (Gym.Location) and active staff count. Also owns the branch logo the
    /// portal shell renders (GET/PUT /api/gyms/{gymId}/logo).
    /// </summary>
    public sealed class GymService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess,
        IFileStorage fileStorage,
        IAccessControlService accessControl) : IGymService
    {
        public async Task<IReadOnlyList<GymListResponse>> GetGymsAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            if (actorUserId is null or <= 0)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var userRepository = unitOfWork.GetRepository<User, int>();
            var user = await userRepository.GetByIdAsync(new UserByIdSpec(actorUserId.Value), cancellationToken);
            if (user is null || !user.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var gymRepository = unitOfWork.GetRepository<Gym, int>();
            // Top Management and HR Manager both reach every active gym; everybody else
            // only sees the gyms granted through UserGymAccess.
            IReadOnlyList<Gym> gyms = user.UserType is UserType.TopManagement or UserType.HRManager
                ? (await gymRepository.GetAllAsync(new ActiveGymsSpec(), cancellationToken)).ToList()
                : (await GetAssignedGymsAsync(user.Id, gymRepository, cancellationToken));

            var employeeRepository = unitOfWork.GetRepository<Employee, int>();
            var response = new List<GymListResponse>(gyms.Count);
            foreach (var gym in gyms)
            {
                // One count per gym keeps the repository contract simple; installs have few gyms.
                var employeeCount = await employeeRepository.CountAsync(
                    new ActiveEmployeesByGymCountSpec(gym.Id), cancellationToken);

                response.Add(new GymListResponse
                {
                    Id = gym.Id,
                    Name = gym.Name,
                    Branch = gym.Location,
                    Employees = employeeCount
                });
            }

            return response;
        }

        public async Task<GymLogoUploadResult> UploadLogoAsync(
            int? actorUserId,
            int gymId,
            string fileName,
            Stream content,
            CancellationToken cancellationToken = default)
        {
            // Branch branding is provisioned centrally, exactly like the branch itself:
            // it is a platform action, not something a gym role grants.
            await accessControl.EnsurePermissionAsync(actorUserId, "platform.branches.manage", cancellationToken);

            if (string.IsNullOrWhiteSpace(fileName))
            {
                throw new BadRequestException("A file name is required.");
            }

            if (!FileContentTypes.IsImage(fileName))
            {
                throw new BadRequestException("Gym logos must be PNG, JPG, WEBP, or GIF.");
            }

            var repository = unitOfWork.GetRepository<Gym, int>();
            var gym = await repository.GetByIdAsync(gymId, cancellationToken)
                ?? throw new NotFoundException("Gym not found.");

            StoredFileInfo stored;
            try
            {
                stored = await fileStorage.SaveAsync("gym-logos", fileName, content, cancellationToken);
            }
            catch (InvalidOperationException exception)
            {
                // Storage refuses over-cap or unsupported content; that is the request's
                // problem, so it surfaces as a 400 rather than a 500.
                throw new BadRequestException(exception.Message);
            }

            var previous = gym.LogoPath;

            try
            {
                gym.LogoPath = stored.RelativePath;
                repository.Update(gym);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch
            {
                // The row never moved on, so the new file is orphaned. Delete is
                // best-effort and must not mask the original failure.
                fileStorage.Delete(stored.RelativePath);
                throw;
            }

            // Only after the commit: the superseded logo is orphaned now, and keeping
            // the new one is what the caller asked for.
            if (!string.IsNullOrWhiteSpace(previous) && previous != stored.RelativePath)
            {
                fileStorage.Delete(previous);
            }

            return new GymLogoUploadResult { LogoUrl = $"/api/gyms/{gym.Id}/logo" };
        }

        public async Task<FileDownload> GetLogoAsync(
            int? actorUserId, int gymId, CancellationToken cancellationToken = default)
        {
            var gym = await unitOfWork.GetRepository<Gym, int>()
                .GetByIdAsync(gymId, cancellationToken)
                ?? throw new NotFoundException("Gym not found.");

            // Same visibility rule as the gym directory: a logo is not readable by
            // someone who cannot reach the gym at all.
            await accessControl.EnsureGymAccessAsync(actorUserId, gymId, cancellationToken);

            if (string.IsNullOrWhiteSpace(gym.LogoPath))
            {
                throw new NotFoundException("No logo has been uploaded for this gym.");
            }

            var content = fileStorage.TryOpenRead(gym.LogoPath)
                ?? throw new NotFoundException("No logo has been uploaded for this gym.");

            return new FileDownload(content, "logo", FileContentTypes.FromFileName(gym.LogoPath));
        }

        private async Task<IReadOnlyList<Gym>> GetAssignedGymsAsync(
            int userId,
            IGenaricRepository<Gym, int> gymRepository,
            CancellationToken cancellationToken)
        {
            var gymIds = (await userAccess.GetGymAccessAsync(userId, cancellationToken))
                .Select(access => access.GymId)
                .ToList();

            if (gymIds.Count == 0)
            {
                return [];
            }

            return (await gymRepository.GetAllAsync(new GymsByIdsSpec(gymIds), cancellationToken)).ToList();
        }
    }
}
