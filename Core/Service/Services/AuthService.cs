using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using Microsoft.EntityFrameworkCore;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Configuration;
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
        IUserSessionService sessionService,
        SecurityLockoutOptions lockoutOptions,
        IMapper mapper) : IAuthService
    {

        public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
        {
            var userRepository = unitOfWork.GetRepository<User, int>();
            var user = await userRepository.GetByIdAsync(new UserByEmailSpec(request.Email ?? string.Empty), cancellationToken);

            // Brute-force lockout: once the account is locked, EVERY sign-in attempt
            // — including the correct password — is refused until the window elapses.
            // (Matrix RateLimitAndLockout spec; "Password_Guessing_Locks_The_Account".)
            if (user is not null && user.LockoutEnd is { } lockoutEnd && lockoutEnd > DateTime.UtcNow)
            {
                throw new UnAuthorizedException(
                    "This account is temporarily locked after repeated failed sign-in attempts. Try again later.");
            }

            // Identical failure for unknown email and wrong password — no user enumeration.
            if (user is null || !passwordHasher.Verify(request.Password ?? string.Empty, user.PasswordHash))
            {
                if (user is not null)
                {
                    user.FailedLoginAttempts++;
                    if (user.FailedLoginAttempts >= lockoutOptions.MaxFailedLogins)
                    {
                        user.LockoutEnd = DateTime.UtcNow.AddMinutes(lockoutOptions.LockoutWindowMinutes);
                    }

                    await unitOfWork.SaveChangesAsync(cancellationToken);
                }

                throw new UnAuthorizedException("Invalid email or password.");
            }

            if (!await sessionService.IsSessionAllowedAsync(user.Id, cancellationToken))
            {
                throw new UnAuthorizedException("Invalid email or password.");
            }

            // Successful password verification resets the brute-force counters.
            user.FailedLoginAttempts = 0;
            user.LockoutEnd = null;

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

            if (!await sessionService.IsSessionAllowedAsync(user.Id, cancellationToken))
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

        public async Task<LoginResponse> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                throw new UnAuthorizedException("Your session has expired. Please sign in again.");
            }

            var hash = tokenService.HashRefreshToken(refreshToken);
            var repo = unitOfWork.GetRepository<DomainLayer.Models.UserModule.RefreshToken, int>();
            var stored = await repo.GetByIdAsync(new Service.Specifications.RefreshTokenByHashSpec(hash), cancellationToken);

            if (stored is null
                || stored.RevokedAtUtc is not null
                || stored.ExpiresAtUtc <= DateTime.UtcNow)
            {
                // Reuse detection: a token that was already ROTATED (it carries the hash
                // of its successor) presented again means the chain was stolen and
                // rotated — revoke the whole chain for that user. An expired token or a
                // token revoked by logout was never rotated: it is simply invalid, and
                // the user's other active sessions stay untouched.
                if (stored?.ReplacedByTokenHash is not null)
                {
                    await sessionService.RevokeAllRefreshTokensAsync(stored.UserId, cancellationToken);
                }
                throw new UnAuthorizedException("Your session has expired. Please sign in again.");
            }

            var user = stored.User;
            if (user is null || !await sessionService.IsSessionAllowedAsync(user.Id, cancellationToken))
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            // Rotate: claim the presented token first, then issue its replacement.
            var newPlain = tokenService.GenerateRefreshToken();
            var newTokenHash = tokenService.HashRefreshToken(newPlain);
            stored.RevokedAtUtc = DateTime.UtcNow;
            stored.ReplacedByTokenHash = newTokenHash;
            unitOfWork.GetRepository<DomainLayer.Models.UserModule.RefreshToken, int>().Update(stored);

            try
            {
                // The claim is a conditional database update: the xmin concurrency
                // token (RefreshTokenConfiguration) turns the save into an
                // UPDATE ... WHERE the row is unchanged, so a concurrent refresh of
                // the same token loses the claim here instead of double-issuing.
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                // A concurrent rotation won the claim: this token was already replaced
                // — presented again, it is reuse; revoke the whole chain.
                await sessionService.RevokeAllRefreshTokensAsync(stored.UserId, cancellationToken);
                throw new UnAuthorizedException("Your session has expired. Please sign in again.");
            }

            var gymAccess = await userAccess.GetGymAccessAsync(user.Id, cancellationToken);
            // Preserve the gym scope the original login selected — under the same rule
            // LoginAsync enforces: a gym-scoped session whose selected gym is no longer
            // accessible cannot refresh. Silently minting an unscoped token (or re-aiming
            // the scope at another gym) would widen the caller beyond the original
            // selection, so refresh is refused and a new sign-in + selection is required.
            var scopedGymId = stored.ScopedGymId;
            if (scopedGymId.HasValue && !gymAccess.Any(g => g.GymId == scopedGymId.Value))
            {
                throw new UnAuthorizedException("Your gym session is no longer valid. Please sign in and select a gym again.");
            }

            var permissions = await userAccess.GetPermissionKeysForGymAsync(user.Id, scopedGymId, cancellationToken);

            var accessToken = tokenService.CreateAccessToken(user, permissions, scopedGymId);

            await unitOfWork.GetRepository<DomainLayer.Models.UserModule.RefreshToken, int>().AddAsync(
                new DomainLayer.Models.UserModule.RefreshToken
                {
                    UserId = user.Id,
                    TokenHash = newTokenHash,
                    ScopedGymId = scopedGymId,
                    ExpiresAtUtc = tokenService.RefreshTokenExpiresAtUtc
                }, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new LoginResponse
            {
                AccessToken = accessToken,
                ExpiresInSeconds = tokenService.AccessTokenExpiresInSeconds,
                RefreshToken = newPlain,
                RefreshExpiresInSeconds = (int)(tokenService.RefreshTokenExpiresAtUtc - DateTime.UtcNow).TotalSeconds,
                User = new UserInfo
                {
                    Id = user.Id,
                    Email = user.Email,
                    UserName = user.UserName,
                    UserType = user.UserType.ToString(),
                    Permissions = permissions.ToArray(),
                    GymAccess = mapper.Map<GymOption[]>(gymAccess),
                    GymId = scopedGymId,
                    GymName = scopedGymId.HasValue ? gymAccess.FirstOrDefault(g => g.GymId == scopedGymId.Value)?.GymName : null
                }
            };
        }

        public async Task<CurrentUserResponse> GetCurrentUserAsync(int? actorUserId, int? selectedGymId, CancellationToken cancellationToken = default)
        {
            if (actorUserId is null or <= 0)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var userRepository = unitOfWork.GetRepository<User, int>();
            var user = await userRepository.GetByIdAsync(new UserByIdWithProfileSpec(actorUserId.Value), cancellationToken);
            if (user is null || !user.IsActive || user.EmployeeProfile?.Status == EmployeeStatus.Terminated)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var employee = user.EmployeeProfile;
            var fullName = employee?.FullName ?? user.UserName;
            var (firstName, lastName) = SplitName(fullName);

            var gymAccess = await userAccess.GetGymAccessAsync(user.Id, cancellationToken);
            // Keys follow the ACTIVE gym's role (per-gym authorization): a Branch
            // Manager in one gym who is a Team Leader in another reports (and
            // carries) that gym's keys, not the union of every global role.
            var permissions = await userAccess.GetPermissionKeysForGymAsync(user.Id, selectedGymId, cancellationToken);

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
            int? scopedGymId = forcedGymId;
            if (scopedGymId is null && gymAccess.Count == 1)
            {
                // Single-gym users (any type) get a token scoped to that gym; users with
                // more than one gym select one via select-gym or switch-gym.
                scopedGymId = gymAccess[0].GymId;
            }

            // The token's keys follow its gym: single-gym users and select-gym
            // requests mint a scoped token, so its keys come from the per-gym
            // role (the pre-selection no-gym token keeps the global key set).
            var permissions = await userAccess.GetPermissionKeysForGymAsync(user.Id, scopedGymId, cancellationToken);

            var scopedGym = scopedGymId.HasValue
                ? gymAccess.FirstOrDefault(g => g.GymId == scopedGymId.Value)
                : null;

            var accessToken = tokenService.CreateAccessToken(user, permissions, scopedGymId);

            // Issue a rotating refresh token so the session can outlive the access
            // token without forcing a re-login (ADR-002 refresh-token amendment).
            var plainRefreshToken = tokenService.GenerateRefreshToken();
            var newTokenHash = tokenService.HashRefreshToken(plainRefreshToken);
            var refreshRepo = unitOfWork.GetRepository<DomainLayer.Models.UserModule.RefreshToken, int>();
            await refreshRepo.AddAsync(
                new DomainLayer.Models.UserModule.RefreshToken
                {
                    UserId = user.Id,
                    TokenHash = newTokenHash,
                    ScopedGymId = scopedGymId,
                    ExpiresAtUtc = tokenService.RefreshTokenExpiresAtUtc
                }, cancellationToken);

            // Single-live-chain discipline (same rationale as SwitchGymAsync): a
            // fresh login/selection revokes every other alive refresh chain of
            // this user, so a stale SPA context can no longer silently refresh
            // an old chain and re-mint a token scoped to a gym the user no
            // longer selected. The new row is excluded by hash (its Id is not
            // assigned until the save).
            var staleChain = await refreshRepo.GetAllAsync(
                new RefreshTokensByUserActiveSpec(user.Id), cancellationToken);
            foreach (var zombie in staleChain)
            {
                zombie.RevokedAtUtc = DateTime.UtcNow;
                refreshRepo.Update(zombie);
            }

            // A concurrent refresh may have claimed one of the fetched chains between
            // the read and this save (xmin concurrency): that update is rejected, but
            // the login/selection itself must not fail — reload the rejected rows
            // (fresh stamps; the winner already revoked/rotated them anyway) and
            // persist the sweep. Mirrors RevokeAllUserRefreshTokensAsync.
            try
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException exception)
            {
                foreach (var entry in exception.Entries)
                {
                    await entry.ReloadAsync(cancellationToken);
                }

                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return new LoginResponse
            {
                AccessToken = accessToken,
                ExpiresInSeconds = tokenService.AccessTokenExpiresInSeconds,
                RefreshToken = plainRefreshToken,
                RefreshExpiresInSeconds = (int)(tokenService.RefreshTokenExpiresAtUtc - DateTime.UtcNow).TotalSeconds,
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

        public async Task LogoutAsync(int userId, string? refreshToken = null, CancellationToken cancellationToken = default)
        {
            // Access-token-only auth (no refresh tokens, ADR-002) means there is no
            // server-side session to revoke: the client discards the token and its own
            // lifetime ends the session. What logout must still do is leave an audit
            // trail, so the record is written for every caller — including an unknown
            // user, keeping the endpoint idempotent (204 either way).
            // Revoke the supplied refresh token (if any) so the session can't be
            // revived after logout.
            if (!string.IsNullOrWhiteSpace(refreshToken))
            {
                var hash = tokenService.HashRefreshToken(refreshToken);
                var repo = unitOfWork.GetRepository<DomainLayer.Models.UserModule.RefreshToken, int>();
                var stored = await repo.GetByIdAsync(new Service.Specifications.RefreshTokenByHashSpec(hash), cancellationToken);
                if (stored is not null && stored.RevokedAtUtc is null)
                {
                    stored.RevokedAtUtc = DateTime.UtcNow;
                    repo.Update(stored);
                }
            }

            try
            {
                await unitOfWork.GetRepository<DomainLayer.Models.AuditModule.AuditLog, int>().AddAsync(
                    new DomainLayer.Models.AuditModule.AuditLog
                    {
                        UserId = userId,
                        Action = "Logout",
                        EntityType = "User",
                        EntityId = userId
                    }, cancellationToken);

                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException exception)
            {
                // The refresh token was claimed by a concurrent rotation while logout
                // recorded its revocation: a rotated token is single-use already, so
                // logout still ends the session. Reload the rejected rows and persist
                // the audit entry with fresh stamps.
                foreach (var entry in exception.Entries)
                {
                    await entry.ReloadAsync(cancellationToken);
                }

                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
    }
}
