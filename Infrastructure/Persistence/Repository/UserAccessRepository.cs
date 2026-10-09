using DomainLayer.Contracts;
using Microsoft.EntityFrameworkCore;
using Presistence.Data;
using DomainLayer.Models.OrganizationModule.Enums;

namespace Presistence.Repository
{
    /// <summary>
    /// Queries over the identity join tables (UserGymAccess / UserPermissions /
    /// UserRoles / RolePermissions) which are not BaseEntity-derived and therefore
    /// not reachable through the generic repository.
    /// </summary>
    public class UserAccessRepository(ReviveHrDbContext _dbContext) : IUserAccessRepository
    {
        public async Task<IReadOnlyList<GymAccessEntry>> GetGymAccessAsync(int userId, CancellationToken cancellationToken = default)
        {
            var entries = await _dbContext.UserGymAccesses
                .Where(uga => uga.UserId == userId)
                .Join(
                    _dbContext.Gyms,
                    uga => uga.GymId,
                    g => g.Id,
                    (uga, g) => g)
                .Where(g => g.Status == GymStatus.Active)
                .Select(g => new GymAccessEntry { GymId = g.Id, GymName = g.Name })
                .OrderBy(e => e.GymId)
                .ToListAsync(cancellationToken);

            return entries;
        }

        public async Task<bool> HasGymAccessAsync(int userId, int gymId, CancellationToken cancellationToken = default) =>
            await _dbContext.UserGymAccesses
                .AnyAsync(uga => uga.UserId == userId && uga.GymId == gymId, cancellationToken);

        public async Task<IReadOnlyList<string>> GetPermissionKeysAsync(int userId, CancellationToken cancellationToken = default)
        {
            var directKeys = await (
                from up in _dbContext.UserPermissions
                where up.UserId == userId
                select up.Permission.Key
            ).ToListAsync(cancellationToken);

            var roleKeys = await (
                from ur in _dbContext.UserRoles
                where ur.UserId == userId
                from rp in _dbContext.RolePermissions
                where rp.RoleId == ur.RoleId
                select rp.Permission.Key
            ).ToListAsync(cancellationToken);

            return directKeys
                .Concat(roleKeys)
                .Where(k => !string.IsNullOrEmpty(k))
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }
    }
}
