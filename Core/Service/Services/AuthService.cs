using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Auth;
using Shared.DataTransferObject.Gym;

namespace Service.Services
{
    /// <summary>
    /// Web login (email + password → access token) and the login-time gym selection
    /// flow for employees assigned to two gyms (ADR-002). Access-token-only: the
    /// database model deliberately has no refresh tokens.
    /// </summary>
    public class AuthService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess,
        IPasswordHasher passwordHasher,
        ITokenService tokenService,
        IMapper mapper) : IAuthService
    {

        public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
        {
            var userRepository = unitOfWork.GetRepository<User, int>();
            var user = await userRepository.GetByIdAsync(new UserByEmailSpec(request.Email ?? string.Empty), cancellationToken);

            // Identical failure for unknown email and wrong password — no user enumeration.
            if (user is null || !passwordHasher.Verify(request.Password ?? string.Empty, user.PasswordHash))
            {
                throw new UnAuthorizedException("Invalid email or password.");
            }

            if (!user.IsActive)
            {
                throw new UnAuthorizedException("Invalid email or password.");
            }

            var gymAccess = await userAccess.GetGymAccessAsync(user.Id, cancellationToken);

            if (user.UserType == UserType.Employee && gymAccess.Count == 0)
            {
                throw new UnAuthorizedException("This employee has no active gym access.");
            }

            if (user.UserType == UserType.Employee && gymAccess.Count >= 2)
            {
                // ADR-002: two-gym employees pick a gym before tokens are issued.
                user.LastLoginAt = DateTime.UtcNow;
                await unitOfWork.SaveChangesAsync(cancellationToken);

                return new LoginResponse
                {
                    RequiresGymSelection = true,
                    Gyms = mapper.Map<GymOption[]>(gymAccess),
                    TempSessionToken = tokenService.CreateGymSelectionToken(user.Id)
                };
            }

            return await IssueTokensAsync(user, gymAccess, forcedGymId: null, cancellationToken);
        }

        public async Task<LoginResponse> SelectGymAsync(SelectGymRequest request, CancellationToken cancellationToken = default)
        {
            var userId = tokenService.ValidateGymSelectionToken(request.TempSessionToken)
                ?? throw new UnAuthorizedException("Your session has expired. Please sign in again.");

            var userRepository = unitOfWork.GetRepository<User, int>();
            var user = await userRepository.GetByIdAsync(new UserByIdSpec(userId), cancellationToken)
                ?? throw new UnAuthorizedException("Your session has expired. Please sign in again.");

            if (!user.IsActive)
            {
                throw new UnAuthorizedException("Your session has expired. Please sign in again.");
            }

            var gymAccess = await userAccess.GetGymAccessAsync(user.Id, cancellationToken);
            if (!gymAccess.Any(g => g.GymId == request.GymId))
            {
                throw new UnAuthorizedException("You do not have access to the selected gym.");
            }

            var selectedGym = await unitOfWork.GetRepository<Gym, int>().GetByIdAsync(request.GymId, cancellationToken);
            if (selectedGym is null || selectedGym.Status != GymStatus.Active)
            {
                throw new UnAuthorizedException("The selected gym is unavailable.");
            }

            user.LastLoginAt = DateTime.UtcNow;
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return await IssueTokensAsync(user, gymAccess, request.GymId, cancellationToken);
        }

        public async Task<CurrentUserResponse> GetCurrentUserAsync(int? actorUserId, int? selectedGymId, CancellationToken cancellationToken = default)
        {
            if (actorUserId is null or <= 0)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var userRepository = unitOfWork.GetRepository<User, int>();
            var user = await userRepository.GetByIdAsync(new UserByIdWithProfileSpec(actorUserId.Value), cancellationToken);
            if (user is null || !user.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var employee = user.EmployeeProfile;
            var fullName = employee?.FullName ?? user.UserName;
            var (firstName, lastName) = SplitName(fullName);

            var gymAccess = await userAccess.GetGymAccessAsync(user.Id, cancellationToken);
            var permissions = await userAccess.GetPermissionKeysAsync(user.Id, cancellationToken);

            return new CurrentUserResponse
            {
                Id = user.Id,
                FirstName = firstName,
                LastName = lastName,
                FullName = fullName,
                Email = user.Email,
                Phone = employee?.Phone,
                Initials = MakeInitials(firstName, lastName),
                Position = employee?.Position?.Title,
                Level = employee?.Position?.Level,
                Role = user.UserType.ToString(),
                Permissions = permissions.ToList(),
                Gyms = gymAccess
                    .Select(g => new GymSummary { Id = g.GymId, Name = g.GymName, Branch = g.Branch })
                    .ToList(),
                SelectedGym = selectedGymId is > 0 ? selectedGymId : null,
                HireDate = employee?.HireDate,
                EmploymentType = employee?.ContractType,
                Status = employee?.Status.ToString()
            };
        }

        private static (string First, string Last) SplitName(string fullName)
        {
            var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            return parts.Length switch
            {
                0 => (string.Empty, string.Empty),
                1 => (parts[0], string.Empty),
                _ => (parts[0], string.Join(' ', parts.Skip(1)))
            };
        }

        private static string MakeInitials(string first, string last) =>
            string.Concat(
                first.Length > 0 ? char.ToUpperInvariant(first[0]) : string.Empty,
                last.Length > 0 ? char.ToUpperInvariant(last[0]) : string.Empty);

        private async Task<LoginResponse> IssueTokensAsync(
            User user,
            IReadOnlyList<GymAccessEntry> gymAccess,
            int? forcedGymId,
            CancellationToken cancellationToken)
        {
            var permissions = await userAccess.GetPermissionKeysAsync(user.Id, cancellationToken);

            int? scopedGymId = forcedGymId;
            if (scopedGymId is null && user.UserType == UserType.Employee && gymAccess.Count == 1)
            {
                scopedGymId = gymAccess[0].GymId;
            }

            var scopedGym = scopedGymId.HasValue
                ? gymAccess.FirstOrDefault(g => g.GymId == scopedGymId.Value)
                : null;

            var accessToken = tokenService.CreateAccessToken(user, permissions, scopedGymId);

            return new LoginResponse
            {
                AccessToken = accessToken,
                ExpiresInSeconds = tokenService.AccessTokenExpiresInSeconds,
                User = new UserInfo
                {
                    Id = user.Id,
                    Email = user.Email,
                    UserName = user.UserName,
                    UserType = user.UserType.ToString(),
                    Permissions = permissions.ToArray(),
                    GymAccess = mapper.Map<GymOption[]>(gymAccess),
                    GymId = scopedGymId,
                    GymName = scopedGym?.GymName
                }
            };
        }
    }
}
