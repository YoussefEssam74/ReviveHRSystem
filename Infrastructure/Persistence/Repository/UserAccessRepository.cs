using DomainLayer.Contracts;
using Microsoft.EntityFrameworkCore;
using Presistence.Data;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule;
using Shared.Authorization;

namespace Presistence.Repository
{
    /// <summary>
    /// Queries over the identity join tables (UserGymAccess / UserPermissions /
    /// UserRoles / RolePermissions) which are not BaseEntity-derived and therefore
    /// not reachable through the generic repository.
    ///
    /// <para><c>UserRoles</c> is the only role grant table: a row with <c>GymId</c>
    /// set is a per-gym role, a row with <c>GymId IS NULL</c> is a platform-wide one.
    /// Permission keys therefore come from the same table whichever reach applies.</para>
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
                where ur.UserId == userId && ur.GymId == null
                from rp in _dbContext.RolePermissions.AsNoTracking()
                where rp.Role.Name == ur.RoleName
                select rp.Permission.Key
            ).ToListAsync(cancellationToken);

            return directKeys
                .Concat(roleKeys)
                .Where(k => !string.IsNullOrEmpty(k))
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }

        public async Task<IReadOnlyList<string>> GetGymRoleNamesAsync(int userId, int gymId, CancellationToken cancellationToken = default) =>
            await _dbContext.UserRoles.AsNoTracking()
                .Where(ur => ur.UserId == userId && ur.GymId == gymId)
                .Select(ur => ur.RoleName)
                .Distinct()
                .ToListAsync(cancellationToken);

        /// <inheritdoc />
        public async Task<bool> HasActiveGymDeskAsync(int gymId, int excludeUserId, CancellationToken cancellationToken = default)
        {
            string[] deskRoles = [RoleNames.TeamLeader, RoleNames.BranchManager, RoleNames.SuperAdmin];

            return await (
                from ur in _dbContext.UserRoles.AsNoTracking()
                where ur.GymId == gymId && ur.UserId != excludeUserId && deskRoles.Contains(ur.RoleName)
                join user in _dbContext.Users.AsNoTracking() on ur.UserId equals user.Id
                where user.IsActive
                select ur.Id
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

            // No per-gym role in the active gym (HR/TopManagement-style accounts,
            // or users whose roles were only ever granted globally): the global
            // role keys carry over rather than dropping the user to key-less.
            if (gymId.HasValue && roleKeys.Count == 0)
            {
                var hasGymRole = await _dbContext.UserRoles.AsNoTracking()
                    .AnyAsync(ur => ur.UserId == userId && ur.GymId == gymId.Value, cancellationToken);
                if (!hasGymRole)
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

        /// <summary>Keys of the roles the user holds in one gym (or platform-wide when gymId is null).</summary>
        private async Task<IReadOnlyList<string>> GymRoleKeysAsync(int userId, int? gymId, CancellationToken cancellationToken) =>
            gymId.HasValue
                ? await (
                    from ur in _dbContext.UserRoles.AsNoTracking()
                    where ur.UserId == userId && ur.GymId == gymId.Value
                    from rp in _dbContext.RolePermissions.AsNoTracking()
                    where rp.Role.Name == ur.RoleName
                    select rp.Permission.Key
                ).ToListAsync(cancellationToken)
                : await GlobalRoleKeysAsync(userId, cancellationToken);

        private async Task<IReadOnlyList<string>> GlobalRoleKeysAsync(int userId, CancellationToken cancellationToken) =>
            await (
                from ur in _dbContext.UserRoles.AsNoTracking()
                where ur.UserId == userId && ur.GymId == null
                from rp in _dbContext.RolePermissions.AsNoTracking()
                where rp.Role.Name == ur.RoleName
                select rp.Permission.Key
            ).ToListAsync(cancellationToken);

        // ------------------------------------------------------------------
        // Roles & permissions (S2)
        // ------------------------------------------------------------------
        //
        // The HR console's "HR Team" page manages one thing: which roles a person
        // holds platform-wide (GymId IS NULL). Per-gym roles are edited elsewhere
        // (the company branch tab), so these helpers deliberately stay scoped to the
        // global grants while the public contract keeps speaking role ids.

        public async Task<IReadOnlyList<int>> GetUserRoleIdsAsync(int userId, CancellationToken cancellationToken = default) =>
            await (
                from ur in _dbContext.UserRoles
                where ur.UserId == userId && ur.GymId == null
                join role in _dbContext.Roles on ur.RoleName equals role.Name
                select role.Id
            ).ToListAsync(cancellationToken);

        public async Task ReplaceUserRolesAsync(int userId, IReadOnlyCollection<int> roleIds, CancellationToken cancellationToken = default)
        {
            var wanted = roleIds.Distinct().ToHashSet();

            var desiredNames = await _dbContext.Roles
                .Where(r => wanted.Contains(r.Id))
                .Select(r => r.Name)
                .ToListAsync(cancellationToken);

            var current = await _dbContext.UserRoles
                .Where(ur => ur.UserId == userId && ur.GymId == null)
                .ToListAsync(cancellationToken);

            var stale = current.Where(ur => !desiredNames.Contains(ur.RoleName)).ToList();
            if (stale.Count > 0)
            {
                _dbContext.UserRoles.RemoveRange(stale);
            }

            var existing = current.Select(ur => ur.RoleName).ToHashSet(StringComparer.Ordinal);
            foreach (var name in desiredNames.Where(name => !existing.Contains(name)))
            {
                _dbContext.UserRoles.Add(new UserRole { UserId = userId, RoleName = name, GymId = null });
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
            var roleName = await _dbContext.Roles
                .Where(r => r.Id == roleId)
                .Select(r => r.Name)
                .FirstOrDefaultAsync(cancellationToken);

            if (roleName is null)
            {
                return 0;
            }

            return await _dbContext.UserRoles
                .Where(ur => ur.GymId == null && ur.RoleName == roleName)
                .Select(ur => ur.UserId)
                .Distinct()
                .CountAsync(cancellationToken);
        }

        /// <summary>
        /// Renames a role and carries every assignment with it.
        ///
        /// RoleName is the FK to Roles.Name, so the rename must rewrite the dependent
        /// rows. EF refuses to modify a property that is part of a key, so this runs as
        /// SQL and the constraint's ON UPDATE CASCADE rewrites the assignments atomically.
        /// </summary>
        public async Task RenameRoleAsync(int roleId, string newName, CancellationToken cancellationToken = default) =>
            await _dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE \"Roles\" SET \"Name\" = {newName} WHERE \"Id\" = {roleId}", cancellationToken);

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
