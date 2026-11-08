using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Service.Specifications;
using ServiceAbstraction.Services;

namespace Service.Services
{
    /// <summary>
    /// Central session gate. <see cref="IsSessionAllowedAsync"/> is consulted by
    /// JWT validation on every authenticated request, so a termination commits
    /// before the terminated employee's next API call. <see cref="TerminateAccessAsync"/>
    /// is shared by every termination path (employee status change, separation
    /// finalize, and separation stage → Completed).
    /// </summary>
    public class UserSessionService(IUnitOfWork unitOfWork, ILogger<UserSessionService> logger) : IUserSessionService
    {
        public async Task<bool> IsSessionAllowedAsync(int userId, CancellationToken cancellationToken = default)
        {
            if (userId <= 0)
            {
                logger.LogWarning("Session refused: {UserId} is not a valid user id.", userId);
                return false;
            }

            var user = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserSessionStatusSpec(userId), cancellationToken);

            // A silent `false` made a rejected refresh impossible to diagnose; record
            // which condition refused it.
            if (user is null)
            {
                logger.LogWarning("Session refused for user {UserId}: no such user row.", userId);
                return false;
            }

            if (!user.IsActive)
            {
                logger.LogWarning("Session refused for user {UserId}: the account is deactivated.", userId);
                return false;
            }

            if (user.EmployeeProfile?.Status == EmployeeStatus.Terminated)
            {
                logger.LogWarning("Session refused for user {UserId}: the employee profile is terminated.", userId);
                return false;
            }

            return true;
        }

        public async Task TerminateAccessAsync(int userId, CancellationToken cancellationToken = default)
        {
            var repo = unitOfWork.GetRepository<User, int>();
            var user = await repo.GetByIdAsync(new UserByIdSpec(userId), cancellationToken);
            if (user is { IsActive: true })
            {
                user.IsActive = false;
                repo.Update(user);
            }

            // Also revokes the tokens of an already-deactivated account, so legacy
            // terminated users cannot keep a live refresh chain.
            await RevokeAllRefreshTokensAsync(userId, cancellationToken);
        }

        public async Task RevokeAllRefreshTokensAsync(int userId, CancellationToken cancellationToken = default)
        {
            var repo = unitOfWork.GetRepository<RefreshToken, int>();
            var activeTokens = await repo.GetAllAsync(new RefreshTokensByUserActiveSpec(userId), cancellationToken);
            var now = DateTime.UtcNow;
            foreach (var token in activeTokens)
            {
                token.RevokedAtUtc = now;
                repo.Update(token);
            }

            try
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException exception)
            {
                // A chain member was claimed by a concurrent refresh mid-revocation.
                // That row is already revoked by the winner; reload the rejected rows
                // (fresh xmin stamps) and persist the revocation of the remaining ones.
                foreach (var entry in exception.Entries)
                {
                    await entry.ReloadAsync(cancellationToken);
                }

                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }

        public async Task RestoreAccessAsync(int userId, CancellationToken cancellationToken = default)
        {
            var repo = unitOfWork.GetRepository<User, int>();
            var user = await repo.GetByIdAsync(new UserByIdSpec(userId), cancellationToken);
            if (user is { IsActive: false })
            {
                user.IsActive = true;
                repo.Update(user);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
    }
}
