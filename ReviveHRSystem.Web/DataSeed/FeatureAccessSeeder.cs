using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Presistence.Data;
using Shared.Authorization;

namespace ReviveHRSystem.Web.DataSeed
{
    /// <summary>
    /// Seeds the authorization catalog (ADR-003 Amendment 1): the feature permissions
    /// (UI areas), the preset roles and their (feature - level) bundles. Idempotent:
    /// re-running updates bundle levels of existing seeded roles without touching
    /// custom roles or user grants.
    ///
    /// Bundle design (see docs/architecture/employee-portal-api-plan.md section 2):
    ///   Employee      - all None (self-service needs no feature level)
    ///   Team Leader   - management features at Edit, evaluations View (BM parity, team scope)
    ///   BranchManager - identical to Team Leader (parity); scope (gym vs team) comes
    ///                   from the per-gym role assignment, not the bundle
    ///   HR            - Team/BM set + evaluations Edit, payroll View, documents Edit,
    ///                   reports View, announcements Edit, audit View
    ///   HR Manager    - every feature at Edit
    ///   Super Admin   - no bundle rows; the '*' wildcard permission grants everything
    /// </summary>
    public static class FeatureAccessSeeder
    {
        private static readonly Dictionary<string, string> FeatureDescriptions = new()
        {
            [Features.Employees] = "Employee directory, profiles and employment actions",
            [Features.Attendance] = "Attendance records, exceptions and manual entry",
            [Features.Schedule] = "Shift cycles, assignments and shift templates",
            [Features.Requests] = "Employee requests and the approval workflow",
            [Features.Payroll] = "Payroll periods, entries and payslips",
            [Features.Evaluations] = "Performance evaluations and criteria",
            [Features.Recruitment] = "Vacancy requests and the recruitment pipeline",
            [Features.Offboarding] = "Employee leaving / offboarding cases",
            [Features.Documents] = "Employee and official documents",
            [Features.Reports] = "Reports and analytics",
            [Features.Announcements] = "Announcements to gyms and employees",
            [Features.Audit] = "Audit log access"
        };

        /// <summary>Management bundle shared by Team Leader and Branch Manager (parity).</summary>
        private static readonly Dictionary<string, AccessLevel> TeamLeaderBranchManagerBundle = new()
        {
            [Features.Employees] = AccessLevel.Edit,
            [Features.Attendance] = AccessLevel.Edit,
            [Features.Schedule] = AccessLevel.Edit,
            [Features.Requests] = AccessLevel.Edit,
            [Features.Recruitment] = AccessLevel.Edit,
            [Features.Offboarding] = AccessLevel.Edit,
            [Features.Evaluations] = AccessLevel.View
        };

        private static readonly Dictionary<string, Dictionary<string, AccessLevel>> RoleBundles = new()
        {
            [RoleNames.Employee] = new Dictionary<string, AccessLevel>(),
            [RoleNames.TeamLeader] = TeamLeaderBranchManagerBundle,
            [RoleNames.BranchManager] = TeamLeaderBranchManagerBundle,
            [RoleNames.Hr] = new Dictionary<string, AccessLevel>
            {
                [Features.Employees] = AccessLevel.Edit,
                [Features.Attendance] = AccessLevel.Edit,
                [Features.Schedule] = AccessLevel.Edit,
                [Features.Requests] = AccessLevel.Edit,
                [Features.Recruitment] = AccessLevel.Edit,
                [Features.Offboarding] = AccessLevel.Edit,
                [Features.Evaluations] = AccessLevel.Edit,
                [Features.Payroll] = AccessLevel.View,
                [Features.Documents] = AccessLevel.Edit,
                [Features.Reports] = AccessLevel.View,
                [Features.Announcements] = AccessLevel.Edit,
                [Features.Audit] = AccessLevel.View
            },
            [RoleNames.HrManager] = Features.All.ToDictionary(f => f, _ => AccessLevel.Edit),
            [RoleNames.SuperAdmin] = new Dictionary<string, AccessLevel>()
        };

        public static async Task SeedCatalogAsync(ReviveHrDbContext db, CancellationToken cancellationToken = default)
        {
            await EnsureWildcardPermissionAsync(db, cancellationToken);
            foreach (var feature in Features.All)
            {
                await EnsureFeatureAsync(db, feature, cancellationToken);
            }

            foreach (var (roleName, bundle) in RoleBundles)
            {
                await EnsureRoleWithBundleAsync(db, roleName, bundle, cancellationToken);
            }
        }

        /// <summary>Assigns a seeded preset role to a user for one gym (idempotent).</summary>
        public static async Task EnsureUserGymRoleAsync(
            ReviveHrDbContext db, int userId, int gymId, string roleName, CancellationToken cancellationToken = default)
        {
            var role = await db.Roles.FirstOrDefaultAsync(r => r.Name == roleName, cancellationToken);
            if (role is null)
            {
                return;
            }

            var exists = await db.UserGymRoles.AnyAsync(
                ugr => ugr.UserId == userId && ugr.GymId == gymId && ugr.RoleId == role.Id, cancellationToken);
            if (exists)
            {
                if (roleName == RoleNames.SuperAdmin)
                {
                    await EnsureWildcardGrantAsync(db, userId, cancellationToken);
                }

                return;
            }

            // A user holds at most one role per gym: a new assignment replaces the old one.
            var current = await db.UserGymRoles
                .Where(ugr => ugr.UserId == userId && ugr.GymId == gymId)
                .ToListAsync(cancellationToken);
            db.UserGymRoles.RemoveRange(current);

            db.UserGymRoles.Add(new UserGymRole { UserId = userId, GymId = gymId, RoleId = role.Id });
            await db.SaveChangesAsync(cancellationToken);

            if (roleName == RoleNames.SuperAdmin)
            {
                await EnsureWildcardGrantAsync(db, userId, cancellationToken);
            }
        }

        /// <summary>
        /// Grants the global '*' wildcard (every feature, Edit, every gym) to a user.
        /// Super Admins receive it instead of per-feature bundle rows.
        /// </summary>
        private static async Task EnsureWildcardGrantAsync(ReviveHrDbContext db, int userId, CancellationToken cancellationToken)
        {
            var wildcard = await db.Permissions.FirstAsync(p => p.Key == Features.Wildcard, cancellationToken);
            var exists = await db.UserPermissions.AnyAsync(
                up => up.UserId == userId && up.PermissionId == wildcard.Id, cancellationToken);
            if (exists)
            {
                return;
            }

            db.UserPermissions.Add(new UserPermission
            {
                UserId = userId,
                PermissionId = wildcard.Id,
                Level = AccessLevel.Edit
            });
            await db.SaveChangesAsync(cancellationToken);
        }

        private static async Task EnsureWildcardPermissionAsync(ReviveHrDbContext db, CancellationToken cancellationToken)
        {
            var exists = await db.Permissions.AnyAsync(p => p.Key == Features.Wildcard, cancellationToken);
            if (exists)
            {
                return;
            }

            db.Permissions.Add(new Permission
            {
                Key = Features.Wildcard,
                Area = "system",
                Description = "Wildcard: grants every feature at Edit level in every gym",
                IsSystem = true
            });
            await db.SaveChangesAsync(cancellationToken);
        }

        private static async Task EnsureFeatureAsync(ReviveHrDbContext db, string feature, CancellationToken cancellationToken)
        {
            var exists = await db.Permissions.AnyAsync(p => p.Key == feature, cancellationToken);
            if (exists)
            {
                return;
            }

            db.Permissions.Add(new Permission
            {
                Key = feature,
                Area = feature,
                Description = FeatureDescriptions.TryGetValue(feature, out var description)
                    ? description
                    : feature,
                IsSystem = true
            });
            await db.SaveChangesAsync(cancellationToken);
        }

        private static async Task EnsureRoleWithBundleAsync(
            ReviveHrDbContext db, string roleName, Dictionary<string, AccessLevel> bundle, CancellationToken cancellationToken)
        {
            var role = await db.Roles
                .Include(r => r.RolePermissions)
                .FirstOrDefaultAsync(r => r.Name == roleName, cancellationToken);

            if (role is null)
            {
                role = new Role { Name = roleName, Description = $"{roleName} preset", IsPreset = true };
                db.Roles.Add(role);
                await db.SaveChangesAsync(cancellationToken);
            }

            foreach (var (feature, level) in bundle)
            {
                var permission = await db.Permissions.FirstAsync(p => p.Key == feature, cancellationToken);
                var rolePermission = role.RolePermissions.FirstOrDefault(rp => rp.PermissionId == permission.Id);
                if (rolePermission is null)
                {
                    role.RolePermissions.Add(new RolePermission
                    {
                        RoleId = role.Id,
                        PermissionId = permission.Id,
                        Level = level
                    });
                }
                else if (rolePermission.Level != level)
                {
                    rolePermission.Level = level;
                }
            }

            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
