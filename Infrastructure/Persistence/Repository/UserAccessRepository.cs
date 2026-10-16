using DomainLayer.Contracts;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Presistence.Data;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule;

namespace Presistence.Repository
{
    /// <summary>
    /// Queries over the identity join tables (UserGymAccess / UserPermissions /
    /// UserRoles / RolePermissions / UserGymRoles / UserGymPermissions) which are
    /// not BaseEntity-derived and therefore not reachable through the generic
    /// repository.
    /// </summary>
    public class UserAccessRepository(ReviveHrDbContext _dbContext) : IUserAccessRepository
    {
        public async Task<IReadOnlyList<GymAccessEntry>> GetGymAccessAsync(int userId, CancellationToken cancellationToken = default)
        {
            var entries = await _dbContext.UserGymAccesses.AsNoTracking()
                .Where(uga => uga.UserId == userId)
                .Join(
                    _dbContext.Gyms.AsNoTracking(),
                    uga => uga.GymId,
                    g => g.Id,
                    (uga, g) => g)
                .Where(g => g.Status == GymStatus.Active)
                .Select(g => new GymAccessEntry { GymId = g.Id, GymName = g.Name, Branch = g.Location })
                .OrderBy(e => e.GymId)
                .ToListAsync(cancellationToken);

            return entries;
        }

        public async Task<bool> HasGymAccessAsync(int userId, int gymId, CancellationToken cancellationToken = default) =>
            await _dbContext.UserGymAccesses.AsNoTracking()
                .AnyAsync(uga => uga.UserId == userId && uga.GymId == gymId, cancellationToken);

        public async Task AddGymAccessAsync(int userId, int gymId, CancellationToken cancellationToken = default)
        {
            if (!await HasGymAccessAsync(userId, gymId, cancellationToken))
            {
                _dbContext.UserGymAccesses.Add(new UserGymAccess { UserId = userId, GymId = gymId });
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }

        public async Task RemoveGymAccessAsync(int userId, int gymId, CancellationToken cancellationToken = default)
        {
            var row = await _dbContext.UserGymAccesses
                .FirstOrDefaultAsync(uga => uga.UserId == userId && uga.GymId == gymId, cancellationToken);
            if (row is not null)
            {
                _dbContext.UserGymAccesses.Remove(row);
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }

        public async Task<IReadOnlyList<string>> GetPermissionKeysAsync(int userId, CancellationToken cancellationToken = default)
        {
            var directKeys = await (
                from up in _dbContext.UserPermissions.AsNoTracking()
                where up.UserId == userId
                select up.Permission.Key
            ).ToListAsync(cancellationToken);

            var roleKeys = await (
                from ur in _dbContext.UserRoles.AsNoTracking()
                where ur.UserId == userId
                from rp in _dbContext.RolePermissions.AsNoTracking()
                where rp.RoleId == ur.RoleId
                select rp.Permission.Key
            ).ToListAsync(cancellationToken);

            return directKeys
                .Concat(roleKeys)
                .Where(k => !string.IsNullOrEmpty(k))
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }

        public async Task<IReadOnlyList<FeatureLevelEntry>> GetGlobalLevelsAsync(int userId, CancellationToken cancellationToken = default) =>
            await _dbContext.UserPermissions.AsNoTracking()
                .Where(up => up.UserId == userId)
                .Select(up => new FeatureLevelEntry { Feature = up.Permission.Key, Level = up.Level })
                .ToListAsync(cancellationToken);

        public async Task<IReadOnlyList<FeatureLevelEntry>> GetGymGrantLevelsAsync(int userId, int gymId, CancellationToken cancellationToken = default) =>
            await _dbContext.UserGymPermissions.AsNoTracking()
                .Where(ugp => ugp.UserId == userId && ugp.GymId == gymId)
                .Select(ugp => new FeatureLevelEntry { Feature = ugp.Permission.Key, Level = ugp.Level })
                .ToListAsync(cancellationToken);

        public async Task<IReadOnlyList<FeatureLevelEntry>> GetGymRoleLevelsAsync(int userId, int gymId, CancellationToken cancellationToken = default) =>
            await (
                from ugr in _dbContext.UserGymRoles.AsNoTracking()
                where ugr.UserId == userId && ugr.GymId == gymId
                from rp in _dbContext.RolePermissions.AsNoTracking()
                where rp.RoleId == ugr.RoleId
                select new FeatureLevelEntry { Feature = rp.Permission.Key, Level = rp.Level }
            ).ToListAsync(cancellationToken);

        public async Task<IReadOnlyList<string>> GetGymRoleNamesAsync(int userId, int gymId, CancellationToken cancellationToken = default) =>
            await (
                from ugr in _dbContext.UserGymRoles.AsNoTracking()
                where ugr.UserId == userId && ugr.GymId == gymId
                select ugr.Role.Name
            ).Distinct()
             .ToListAsync(cancellationToken);

        // ------------------------------------------------------------------
        // Roles & permissions (S2)
        // ------------------------------------------------------------------

        public async Task<IReadOnlyList<int>> GetUserRoleIdsAsync(int userId, CancellationToken cancellationToken = default) =>
            await _dbContext.UserRoles
                .Where(ur => ur.UserId == userId)
                .Select(ur => ur.RoleId)
                .ToListAsync(cancellationToken);

        public async Task ReplaceUserRolesAsync(int userId, IReadOnlyCollection<int> roleIds, CancellationToken cancellationToken = default)
        {
            var desired = roleIds.Distinct().ToHashSet();
            var current = await _dbContext.UserRoles
                .Where(ur => ur.UserId == userId)
                .ToListAsync(cancellationToken);

            var stale = current.Where(ur => !desired.Contains(ur.RoleId)).ToList();
            if (stale.Count > 0)
            {
                _dbContext.UserRoles.RemoveRange(stale);
            }

            var existing = current.Select(ur => ur.RoleId).ToHashSet();
            foreach (var roleId in desired.Where(id => !existing.Contains(id)))
            {
                _dbContext.UserRoles.Add(new UserRole { UserId = userId, RoleId = roleId });
            }
        }

        public async Task<IReadOnlyList<string>> GetUserDirectPermissionKeysAsync(int userId, CancellationToken cancellationToken = default) =>
            await _dbContext.UserPermissions
                .Where(up => up.UserId == userId)
                .Select(up => up.Permission.Key)
                .ToListAsync(cancellationToken);

        public async Task ReplaceUserPermissionsAsync(int userId, IReadOnlyCollection<int> permissionIds, CancellationToken cancellationToken = default)
        {
            var desired = permissionIds.Distinct().ToHashSet();
            var current = await _dbContext.UserPermissions
                .Where(up => up.UserId == userId)
                .ToListAsync(cancellationToken);

            var stale = current.Where(up => !desired.Contains(up.PermissionId)).ToList();
            if (stale.Count > 0)
            {
                _dbContext.UserPermissions.RemoveRange(stale);
            }

            var existing = current.Select(up => up.PermissionId).ToHashSet();
            foreach (var permissionId in desired.Where(id => !existing.Contains(id)))
            {
                _dbContext.UserPermissions.Add(new UserPermission { UserId = userId, PermissionId = permissionId });
            }
        }

        public async Task<int> CountUsersWithRoleAsync(int roleId, CancellationToken cancellationToken = default) =>
            await _dbContext.UserRoles
                .Where(ur => ur.RoleId == roleId)
                .Select(ur => ur.UserId)
                .Distinct()
                .CountAsync(cancellationToken);

        public async Task ArchiveRoleAsync(int roleId, CancellationToken cancellationToken = default)
        {
            var role = await _dbContext.Roles
                .FirstOrDefaultAsync(r => r.Id == roleId, cancellationToken)
                ?? throw new KeyNotFoundException($"Role {roleId} not found.");

            // IsDeleted is a shadow property (ReviveHrDbContext): flipping it hides
            // the role from every global query filter — listing, join-table
            // resolution, permission grants — without touching referencing rows.
            _dbContext.Entry(role).Property("IsDeleted").CurrentValue = true;
        }
    }
}
