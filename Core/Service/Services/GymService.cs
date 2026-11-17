using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Gym;

namespace Service.Services
{
    /// <summary>
    /// Gym directory for the portal shell (GET /api/gyms): every active gym for
    /// Top Management, only the user's assigned gyms otherwise, each with its branch
    /// location (Gym.Location) and active staff count.
    /// </summary>
    public sealed class GymService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess) : IGymService
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
            IReadOnlyList<Gym> gyms = user.UserType == UserType.TopManagement
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
