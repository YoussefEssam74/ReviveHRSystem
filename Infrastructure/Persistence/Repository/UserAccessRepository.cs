using DomainLayer.Contracts;
using Microsoft.EntityFrameworkCore;
using Presistence.Data;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Shared.Authorization;

namespace Presistence.Repository
{
    /// <summary>
    /// Queries over the identity join tables (UserGymAccess / UserPermissions /
    /// UserRoles / RolePermissions / UserGymRoles) which are not BaseEntity-derived
    /// and therefore not reachable through the generic repository.
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

        public async Task<bool> IsTopManagementAsync(int userId, CancellationToken cancellationToken = default) =>
            await _dbContext.Users.AsNoTracking()
                .AnyAsync(u => u.Id == userId && u.UserType == UserType.TopManagement, cancellationToken);

        public async Task<bool> CoversGymAsync(int userId, int gymId, CancellationToken cancellationToken = default) =>
            await IsTopManagementAsync(userId, cancellationToken)
            || await HasGymAccessAsync(userId, gymId, cancellationToken);

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

        public async Task<IReadOnlyList<string>> GetGymRoleNamesAsync(int userId, int gymId, CancellationToken cancellationToken = default) =>
            await (
                from ugr in _dbContext.UserGymRoles.AsNoTracking()
                where ugr.UserId == userId && ugr.GymId == gymId
                select ugr.Role.Name
            ).Distinct()
             .ToListAsync(cancellationToken);

        public async Task<IReadOnlyList<int>> GetUserGymRoleIdsAsync(int userId, int gymId, CancellationToken cancellationToken = default) =>
            await _dbContext.UserGymRoles.AsNoTracking()
                .Where(ugr => ugr.UserId == userId && ugr.GymId == gymId)
                .Select(ugr => ugr.RoleId)
                .Distinct()
                .ToListAsync(cancellationToken);

        public async Task ReplaceUserGymRolesAsync(int userId, int gymId, IReadOnlyCollection<int> roleIds, CancellationToken cancellationToken = default)
        {
            var desired = roleIds.Distinct().ToHashSet();
            var current = await _dbContext.UserGymRoles
                .Where(ugr => ugr.UserId == userId && ugr.GymId == gymId)
                .ToListAsync(cancellationToken);

            var stale = current.Where(ugr => !desired.Contains(ugr.RoleId)).ToList();
            if (stale.Count > 0)
            {
                _dbContext.UserGymRoles.RemoveRange(stale);
            }

            var existing = current.Select(ugr => ugr.RoleId).ToHashSet();
            foreach (var roleId in desired.Where(id => !existing.Contains(id)))
            {
                _dbContext.UserGymRoles.Add(new UserGymRole { UserId = userId, GymId = gymId, RoleId = roleId });
            }
        }

        public async Task ReplaceUserGymRolesForGymsAsync(int userId, IReadOnlyCollection<int> gymIds, IReadOnlyCollection<int> roleIds, CancellationToken cancellationToken = default)
        {
            foreach (var gymId in gymIds.Distinct())
            {
                await ReplaceUserGymRolesAsync(userId, gymId, roleIds, cancellationToken);
            }
        }

        public async Task SyncGlobalRolesFromGymRolesAsync(int userId, CancellationToken cancellationToken = default)
        {
            var persisted = await _dbContext.UserGymRoles.AsNoTracking()
                .Where(ugr => ugr.UserId == userId)
                .Select(ugr => ugr.RoleId)
                .ToListAsync(cancellationToken);

            // The per-gym rows were just written in this unit of work and are not
            // flushed yet, so the tracked Added rows must join the union too.
            var pending = _dbContext.ChangeTracker.Entries<UserGymRole>()
                .Where(entry => entry.Entity.UserId == userId
                    && entry.State is EntityState.Added or EntityState.Unchanged or EntityState.Modified)
                .Select(entry => entry.Entity.RoleId);

            var desired = persisted.Concat(pending).ToHashSet();

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

        /// <inheritdoc />
        public async Task<bool> HasActiveGymDeskAsync(int gymId, int excludeUserId, CancellationToken cancellationToken = default)
        {
            string[] deskRoles = [RoleNames.TeamLeader, RoleNames.BranchManager, RoleNames.SuperAdmin];

            return await (
                from ugr in _dbContext.UserGymRoles.AsNoTracking()
                where ugr.GymId == gymId && ugr.UserId != excludeUserId
                join user in _dbContext.Users.AsNoTracking() on ugr.UserId equals user.Id
                where user.IsActive && deskRoles.Contains(ugr.Role.Name)
                select ugr.RoleId
            ).AnyAsync(cancellationToken);
        }

        /// <inheritdoc />
        public async Task<IReadOnlyList<string>> GetPermissionKeysForGymAsync(int userId, int? gymId, CancellationToken cancellationToken = default)
        {
            var directKeys = await (
                from up in _dbContext.UserPermissions.AsNoTracking()
                where up.UserId == userId
                select up.Permission.Key
            ).ToListAsync(cancellationToken);

            var roleKeys = await GymRoleKeysAsync(userId, gymId, cancellationToken);

            // Global role keys apply only to accounts that hold NO per-gym role
            // anywhere (legacy HR/TopManagement-style accounts). A user who holds
            // a role in another gym must not borrow that gym's keys here.
            if (gymId.HasValue && roleKeys.Count == 0)
            {
                var hasAnyGymRole = await _dbContext.UserGymRoles.AsNoTracking()
                    .AnyAsync(ugr => ugr.UserId == userId, cancellationToken);
                if (!hasAnyGymRole)
                {
                    roleKeys = await GlobalRoleKeysAsync(userId, cancellationToken);
                }
            }

            return directKeys
                .Concat(roleKeys)
                .Where(k => !string.IsNullOrEmpty(k))
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }

        /// <summary>Keys of the roles the user holds in one gym (or globally when gymId is null).</summary>
        private async Task<IReadOnlyList<string>> GymRoleKeysAsync(int userId, int? gymId, CancellationToken cancellationToken) =>
            gymId.HasValue
                ? await (
                    from ugr in _dbContext.UserGymRoles.AsNoTracking()
                    where ugr.UserId == userId && ugr.GymId == gymId.Value
                    from rp in _dbContext.RolePermissions.AsNoTracking()
                    where rp.RoleId == ugr.RoleId
                    select rp.Permission.Key
                ).ToListAsync(cancellationToken)
                : await GlobalRoleKeysAsync(userId, cancellationToken);

        private async Task<IReadOnlyList<string>> GlobalRoleKeysAsync(int userId, CancellationToken cancellationToken) =>
            await (
                from ur in _dbContext.UserRoles.AsNoTracking()
                where ur.UserId == userId
                from rp in _dbContext.RolePermissions.AsNoTracking()
                where rp.RoleId == ur.RoleId
                select rp.Permission.Key
            ).ToListAsync(cancellationToken);

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

        public async Task<int> CountUsersWithRoleAsync(int roleId, CancellationToken cancellationToken = default)
        {
            var globalUsers = await _dbContext.UserRoles.AsNoTracking()
                .Where(ur => ur.RoleId == roleId)
                .Select(ur => ur.UserId)
                .ToListAsync(cancellationToken);

            var gymUsers = await _dbContext.UserGymRoles.AsNoTracking()
                .Where(ugr => ugr.RoleId == roleId)
                .Select(ugr => ugr.UserId)
                .ToListAsync(cancellationToken);

            return globalUsers.Concat(gymUsers).Distinct().Count();
        }

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
