using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.SchedulingModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Presistence.Data;
using ServiceAbstraction.Services;
using Shared.Authorization;
using System.Security.Cryptography;

namespace ReviveHRSystem.Web.DataSeed
{
    /// <summary>
    /// Idempotent Development-only seed so login + attendance are testable end-to-end.
    /// Creates two gyms, the authorization catalog (features + preset roles with
    /// per-gym role assignments), HR/Admin/employee accounts covering the ADR-004
    /// validation matrix, a randomly generated active 6-digit station code per gym,
    /// and a published shift cycle covering today. Also applies pending EF migrations
    /// on startup in Development.
    ///
    /// Station codes are never hardcoded: each gym gets a freshly generated unique
    /// code (the seeded value is logged), and production codes are created by HR via
    /// POST /api/gyms/{gymId}/station-codes. Seeded codes only carry an expiry when
    /// DevelopmentSeeder:StationCodeLifetimeMinutes is configured (by default they
    /// never expire, so development sessions and the integration suite are stable);
    /// codes generated through the HR rotation endpoint always get the production
    /// StationCode:ExpirationMinutes lifetime.
    ///
    /// Scenario matrix:
    ///   EMP-1042 Karim — access: gym1 only, shift at gym1 today, Employee role
    ///   EMP-1051 Omar  — access: gym1 + gym2, shift at gym1 today (→ WRONG_BRANCH at gym2),
    ///                    Branch Manager role at gym1, Team Leader role at gym2
    ///   EMP-1060 Sara  — access: gym2 only, no shift today       (→ SCHEDULED_DAY_OFF at gym2)
    /// </summary>
    public static class DevelopmentDataSeeder
    {
        public const string AdminEmail = "admin@revive.hr";
        public const string HrEmail = "hr@revive.hr";
        public const string HrManagerEmail = "hrmanager@revive.hr";
        public const string EmployeePassword = "Revive!2026";
        public const string Gym1Name = "Revive Main Gym";
        public const string Gym2Name = "Revive Second Gym";

        /// <summary>Optional lifetime (minutes) for seeded station codes; null keeps them valid forever.</summary>
        private const string StationCodeLifetimeKey = "DevelopmentSeeder:StationCodeLifetimeMinutes";

        /// <summary>
        /// Switch for the rich console-testing dataset (12 extra employees and their
        /// history). On by default; the Testing host always skips it (see SeedAsync)
        /// because the integration suite asserts against the lean scenario and owns
        /// several of the teams and employees it would otherwise pre-create.
        /// </summary>
        private const string RichScenarioEnabledKey = "DevelopmentSeeder:RichScenario";

        public static async Task SeedAsync(IServiceProvider services)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var configuration = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>();
            var hostEnvironment = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Hosting.IHostEnvironment>();
            var logger = scope.ServiceProvider
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("DevelopmentDataSeeder");
            var attendanceTimeZone = scope.ServiceProvider.GetRequiredService<TimeZoneInfo>();

            await db.Database.MigrateAsync();

            // Preset roles first, so per-gym role assignments below can reference them.
            await EnsurePresetRolesAsync(db);

            // The tracked permission keys (attendance.view, payroll.export, ...) the
            // HR-portal guards check.
            await EnsurePermissionCatalogAsync(db);

            // Bundles for the management presets: without them the seeded portal
            // managers hold no permission keys at all and every key-gated page 403s.
            await EnsurePresetRolePermissionsAsync(db);

            var admin = await EnsureUserAsync(db, hasher, AdminEmail, "admin", UserType.TopManagement);
            var gym1 = await EnsureGymAsync(db, Gym1Name, "Cairo");
            var gym2 = await EnsureGymAsync(db, Gym2Name, "Alexandria");
            await EnsureGymAccessAsync(db, admin.Id, gym1.Id);
            await EnsureGymAccessAsync(db, admin.Id, gym2.Id);
            await EnsureUserGymRoleAsync(db, admin.Id, gym1.Id, RoleNames.SuperAdmin);
            await EnsureUserGymRoleAsync(db, admin.Id, gym2.Id, RoleNames.SuperAdmin);

            // HR users (same password) so per-gym feature access is demonstrable.
            // Both are gym staff and hold employee profiles — the converged matrix
            // (row 22: actor-based contact writes) requires every working role to
            // have a profile of its own.
            var position1 = await EnsurePositionAsync(db, gym1.Id, "Fitness Trainer");
            var position2 = await EnsurePositionAsync(db, gym2.Id, "Fitness Trainer");

            var (hrProfile, hr) = await EnsureEmployeeAsync(db, hasher, HrEmail, "hr",
                "Hana Refaat", "EMP-1001", gym1.Id, position1.Id, UserType.HR);
            await EnsureGymAccessAsync(db, hr.Id, gym1.Id);
            await EnsureUserGymRoleAsync(db, hr.Id, gym1.Id, RoleNames.Hr);
            // The HR-portal guards read direct UserPermissions rows, which the
            // per-gym role assignment above does not populate.
            await EnsurePermissionGrantsAsync(db, hr.Id, AllPortalPermissionKeys);

            var (hrManagerProfile, hrManager) = await EnsureEmployeeAsync(db, hasher, HrManagerEmail, "hrmanager",
                "Mona Aly", "EMP-1002", gym1.Id, position1.Id, UserType.HR);
            await EnsureGymAccessAsync(db, hrManager.Id, gym1.Id);
            await EnsureGymAccessAsync(db, hrManager.Id, gym2.Id);
            await EnsureUserGymRoleAsync(db, hrManager.Id, gym1.Id, RoleNames.HrManager);
            await EnsureUserGymRoleAsync(db, hrManager.Id, gym2.Id, RoleNames.HrManager);
            await EnsurePermissionGrantsAsync(db, hrManager.Id, AllPortalPermissionKeys);

            var stationCodeLifetimeMinutes = configuration.GetValue<int?>(StationCodeLifetimeKey);
            var gym1StationCode = await EnsureStationCodeAsync(db, gym1.Id, admin.Id, stationCodeLifetimeMinutes, logger);
            var gym2StationCode = await EnsureStationCodeAsync(db, gym2.Id, admin.Id, stationCodeLifetimeMinutes, logger);

            var template = await EnsureShiftTemplateAsync(db, gym1.Id);

            // Seed today's schedule using the same configured timezone as attendance checks.
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone));
            var cycle1 = await EnsureCycleAsync(db, gym1.Id, today, admin.Id);

            // Karim - gym1 only, shift today at gym1. Plain employee (self-service only).
            var (karim, karimUser) = await EnsureEmployeeAsync(db, hasher, "karim@revive.hr", "karim",
                "Karim Hassan", "EMP-1042", gym1.Id, position1.Id);
            await EnsureGymAccessAsync(db, karimUser.Id, gym1.Id);
            await EnsureUserGymRoleAsync(db, karimUser.Id, gym1.Id, RoleNames.Employee);
            await EnsureAssignmentAsync(db, cycle1.Id, karim.Id, today, template.Id);

            // Omar - access to both gyms but only scheduled at gym1 today.
            // Demonstrates per-gym roles: Branch Manager at gym1, Team Leader at gym2.
            var (omar, omarUser) = await EnsureEmployeeAsync(db, hasher, "omar@revive.hr", "omar",
                "Omar Youssef", "EMP-1051", gym1.Id, position1.Id);
            await EnsureGymAccessAsync(db, omarUser.Id, gym1.Id);
            await EnsureGymAccessAsync(db, omarUser.Id, gym2.Id);
            await EnsureUserGymRoleAsync(db, omarUser.Id, gym1.Id, RoleNames.BranchManager);
            await EnsureUserGymRoleAsync(db, omarUser.Id, gym2.Id, RoleNames.TeamLeader);
            // The system roles carry the permission-key bundles (RolePermissions); the
            // per-gym rows above only scope the data — so the BM/Team Leader keys stay
            // per-gym instead of leaking to every gym through direct grants.
            await EnsureUserRoleAsync(db, omarUser.Id, RoleNames.BranchManager);
            await EnsureUserRoleAsync(db, omarUser.Id, RoleNames.TeamLeader);
            await EnsureAssignmentAsync(db, cycle1.Id, omar.Id, today, template.Id);

            // Sara - gym2 only, deliberately no shift today. Member of omar's team so
            // the Team Leader scope (team pages, request desk) is demonstrable.
            var (sara, saraUser) = await EnsureEmployeeAsync(db, hasher, "sara@revive.hr", "sara",
                "Sara Ali", "EMP-1060", gym2.Id, position2.Id);
            await EnsureGymAccessAsync(db, saraUser.Id, gym2.Id);
            await EnsureUserGymRoleAsync(db, saraUser.Id, gym2.Id, RoleNames.Employee);
            var team = await EnsureTeamAsync(db, gym2.Id, "Alexandria Floor Team");
            await EnsureTeamLeaderAsync(db, team.Id, omar.Id);
            sara.TeamId = team.Id;
            await db.SaveChangesAsync();

            // Demo salary history: the absence/late sweep falls back to the latest
            // compensation when no payroll sheet covers the day, so every seeded
            // employee can be priced even before his first sheet exists.
            await EnsureCompensationAsync(db, hrProfile.Id, admin.Id, 8000m, today);
            await EnsureCompensationAsync(db, hrManagerProfile.Id, admin.Id, 12000m, today);
            await EnsureCompensationAsync(db, karim.Id, admin.Id, 7000m, today);
            await EnsureCompensationAsync(db, omar.Id, admin.Id, 9000m, today);
            await EnsureCompensationAsync(db, sara.Id, admin.Id, 6000m, today);

            // Payroll months, leave taken and attendance facts for the previous
            // month, so My Payroll's monthly breakdown has a full story to tell.
            await EnsurePayrollAsync(db, gym1, gym2, karim, omar, sara, hrManager.Id, today, attendanceTimeZone);

            // No HTTP endpoint creates payroll periods, so without seed data the
            // Settlement sheet / deductions / publish / payslips / export screens
            // would have nothing to open. One Open period per gym, Draft entries
            // for that gym's active employees.
            await EnsurePayrollSeedAsync(db, gym1.Id, today);
            await EnsurePayrollSeedAsync(db, gym2.Id, today);

            // Rich console-testing scenario layered on top (12 extra employees,
            // months of attendance/payroll history, request/recruitment/evaluation/
            // offboarding pipelines, branch queues, announcements, events).
            // Idempotent — guarded by its own marker. The Testing host skips it: the
            // integration suite asserts against the lean scenario and owns several of
            // the teams/employees this dataset would pre-create.
            if (!hostEnvironment.IsEnvironment("Testing") && configuration.GetValue(RichScenarioEnabledKey, true))
            {
                await RichScenarioSeeder.SeedAsync(db, hasher, logger);
            }

            logger.LogWarning(
                "Development seed complete. Logins (password {Password}): {Admin}, hr@revive.hr, hrmanager@revive.hr, and employee accounts (karim@revive.hr, omar@revive.hr, sara@revive.hr). " +
                "Station codes: {Gym1}={Code1}, {Gym2}={Code2} (generated - fetch any time via GET /api/gyms/{{gymId}}/station-codes as an HR/admin user). " +
                "Per-gym roles: admin=Super Admin, hr=HR (gym1), hrmanager=HR Manager (both gyms), karim=Employee, omar=Branch Manager (gym1) / Team Leader (gym2), sara=Employee",
                EmployeePassword, AdminEmail, gym1.Name, gym1StationCode, gym2.Name, gym2StationCode);
        }

        // ------------------------------------------------------------------
        // Permission catalog (S2)
        // ------------------------------------------------------------------

        /// <summary>
        /// The 50 tracked permission keys / 13 areas from docs/product/features.md plus the
        /// api-spec-from-ui.md additions (payroll.export, events.view, evaluations.forms.manage) —
        /// the stated seeding source of truth. Idempotent: existing keys are left
        /// untouched (grants are the source of truth), missing ones are inserted
        /// with IsSystem=true. The UI mock's "42" total is stale; api.md documents
        /// the discrepancy.
        /// </summary>
        private static readonly (string Area, string Key, string Description)[] PermissionCatalog =
        [
            ("Employees", "employees.view", "View the employee directory and profiles."),
            ("Employees", "employees.create", "Onboard new employees."),
            ("Employees", "employees.edit", "Edit employee profiles."),
            ("Employees", "employees.transfer", "Transfer employees between gyms."),
            ("Employees", "employees.position.change", "Change an employee's position or level."),
            ("Employees", "employees.role.assign", "Assign or change an employee's system role."),
            ("Employees", "employees.status.change", "Change employee status (leave, suspend, terminate)."),
            ("Employees", "employees.compensation.manage", "Manage compensation records."),
            ("Employees", "employees.contract.manage", "Manage contract terms."),
            ("Employees", "employees.offboard", "Offboard employees."),
            ("Employees", "employees.documents.view", "View employee documents."),
            ("Employees", "employees.documents.manage", "Upload or manage employee documents."),
            ("Employees", "employees.bulk_import", "Bulk import employees from CSV."),
            ("Employees", "employees.leave_balance.manage", "Edit leave balances."),
            ("Positions", "positions.view", "View the positions catalog."),
            ("Positions", "positions.manage", "Create and edit positions."),
            ("Recruitment", "recruitment.view", "View vacancies, candidates, and the pipeline."),
            ("Recruitment", "recruitment.vacancies.manage", "Create and edit vacancies."),
            ("Recruitment", "recruitment.candidates.manage", "Manage candidates and stages."),
            ("Recruitment", "recruitment.hire.approve", "Approve offers and hire candidates."),
            ("Recruitment", "recruitment.vacancy_request.create", "Submit vacancy requests."),
            ("Recruitment", "recruitment.vacancy_request.approve", "Approve or reject vacancy requests."),
            ("Attendance", "attendance.view", "View attendance logs."),
            ("Attendance", "attendance.edit", "Edit attendance records."),
            ("Attendance", "attendance.manual_entry", "Record manual attendance entries (failed Face ID)."),
            ("Schedule", "schedule.view", "View shift templates and cycles."),
            ("Schedule", "schedule.manage", "Manage shift templates, cycles, and assignments."),
            ("Requests", "requests.view", "View time-off and shift-swap requests."),
            ("Requests", "requests.approve.branch", "Stage-1 approval of requests for own branch."),
            ("Requests", "requests.approve", "Final approval authority over requests."),
            ("Payroll", "payroll.view", "View payroll data."),
            ("Payroll", "payroll.edit", "Edit payroll records."),
            ("Payroll", "payroll.approve", "Approve payroll runs."),
            ("Payroll", "payroll.export", "Export payroll (CSV/PDF)."),
            ("Evaluations", "evaluations.view", "View evaluations."),
            ("Evaluations", "evaluations.manage", "Create and manage evaluation forms."),
            ("Evaluations", "evaluations.forms.manage", "Create, edit, and dispatch hiring/evaluation forms."),
            ("Events", "events.view", "View the HR action queue (events)."),
            ("Reports", "reports.view", "View and export reports."),
            ("Announcements", "announcements.view", "View announcements."),
            ("Announcements", "announcements.manage", "Compose and broadcast announcements."),
            ("Audit Logs", "audit.view", "View audit logs."),
            ("Teams", "team.view", "View the Roles & Permissions admin page."),
            ("Teams", "team.manage", "Manage roles, permissions, and user assignments."),
            ("Teams", "attendance.view.team", "View attendance of own team members."),
            ("Teams", "schedule.view.team", "View the schedule of own team members."),
            ("Teams", "requests.view.team", "View requests from own team members."),
            ("Teams", "requests.approve.team", "Approve requests from own team members."),
            ("Teams", "evaluations.view.team", "View evaluations of own team members."),
            ("Teams", "evaluations.manage.team", "Manage evaluations of own team members."),
        ];

        /// <summary>
        /// Tracked permission keys granted to the seeded HR / HR-Manager accounts so
        /// every HR-portal endpoint is exercisable in Swagger manual testing without
        /// hand-editing the database. The HR-portal guards read direct
        /// <c>UserPermissions</c> rows (UserAccessRepository.GetPermissionKeysAsync),
        /// which the per-gym feature roles above do not populate.
        /// </summary>
        private static readonly string[] AllPortalPermissionKeys =
        [
            "employees.view", "employees.create", "employees.edit", "employees.transfer",
            "employees.position.change", "employees.role.assign", "employees.status.change",
            "employees.compensation.manage", "employees.contract.manage", "employees.offboard",
            "employees.documents.view", "employees.documents.manage", "employees.bulk_import",
            "employees.leave_balance.manage",
            "positions.view", "positions.manage",
            "recruitment.view", "recruitment.vacancies.manage", "recruitment.candidates.manage",
            "recruitment.hire.approve", "recruitment.vacancy_request.create", "recruitment.vacancy_request.approve",
            "attendance.view", "attendance.edit", "attendance.manual_entry",
            "schedule.view", "schedule.manage",
            "requests.view", "requests.approve.branch", "requests.approve",
            "payroll.view", "payroll.edit", "payroll.approve", "payroll.export",
            "evaluations.view", "evaluations.manage", "evaluations.forms.manage",
            "events.view", "reports.view",
            "announcements.view", "announcements.manage",
            "audit.view",
            "team.view", "team.manage",
        ];

        /// <summary>
        /// Idempotently grants tracked permission keys (UserPermissions rows) so
        /// the HR-portal endpoint guards accept the seeded accounts. Keys that do
        /// not exist in the catalog are skipped.
        /// </summary>
        private static async Task EnsurePermissionGrantsAsync(ReviveHrDbContext db, int userId, IReadOnlyList<string> keys)
        {
            var wanted = await db.Permissions
                .Where(p => keys.Contains(p.Key))
                .Select(p => p.Id)
                .ToListAsync();
            var existing = await db.UserPermissions
                .Where(up => up.UserId == userId)
                .Select(up => up.PermissionId)
                .ToListAsync();

            var missing = wanted.Except(existing).ToList();
            if (missing.Count == 0)
            {
                return;
            }

            foreach (var permissionId in missing)
            {
                db.UserPermissions.Add(new UserPermission
                {
                    UserId = userId,
                    PermissionId = permissionId,
                });
            }

            await db.SaveChangesAsync();
        }

        /// <summary>Inserts any catalog keys that are not yet tracked (never overwrites existing rows).</summary>
        private static async Task EnsurePermissionCatalogAsync(ReviveHrDbContext db)
        {
            var existingKeys = (await db.Permissions.Select(p => p.Key).ToListAsync())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var missing = PermissionCatalog
                .Where(entry => !existingKeys.Contains(entry.Key))
                .ToList();
            if (missing.Count == 0)
            {
                return;
            }

            foreach (var (area, key, description) in missing)
            {
                db.Permissions.Add(new Permission
                {
                    Key = key,
                    Area = area,
                    Description = description,
                    IsSystem = true,
                });
            }

            await db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------
        // Preset roles & per-gym role assignment (data scope).
        // The per-gym role decides the data scope (Team Leader ⇒ team scope,
        // other roles ⇒ gym scope) and the session's roleInActiveGym label.
        // ------------------------------------------------------------------

        private static readonly string[] PresetRoleNames =
        [
            RoleNames.Employee,
            RoleNames.TeamLeader,
            RoleNames.BranchManager,
            RoleNames.Hr,
            RoleNames.HrManager,
            RoleNames.SuperAdmin
        ];

        private static async Task EnsurePresetRolesAsync(ReviveHrDbContext db)
        {
            var existing = (await db.Roles.Select(r => r.Name).ToListAsync())
                .ToHashSet(StringComparer.Ordinal);

            foreach (var roleName in PresetRoleNames.Where(name => !existing.Contains(name)))
            {
                db.Roles.Add(new Role { Name = roleName, Description = $"{roleName} preset", IsPreset = true });
            }

            await db.SaveChangesAsync();
        }

        /// <summary>
        /// Grants the permission keys the two management presets exercise through the
        /// portals (Role → RolePermission). Plain employees stay key-less: everything
        /// self-service is scope-based. Production manages these bundles on the
        /// Roles &amp; Permissions page; the seed only mirrors the agreed defaults so
        /// the Branch Manager / Team Leader demo accounts can actually work.
        /// </summary>
        private static readonly Dictionary<string, string[]> PresetRolePermissionKeys = new()
        {
            [RoleNames.TeamLeader] =
            [
                "employees.view",        // branch employees directory + performance drill-in (TL shares the BM pages)
                "attendance.view",       // attendance management grid (TL shares the BM pages)
                "evaluations.view",      // team performance drill-in
                "requests.view",         // member request details from the desk
                "schedule.view",         // team/branch schedule
                "schedule.manage",       // publish shift cycles
                // Recruitment stays Branch-Manager-only: TLs do not get the
                // recruitment.view / vacancy_request keys by design.
            ],
            [RoleNames.BranchManager] =
            [
                "employees.view",               // directory + profile drill-in
                "employees.status.change",      // activate/deactivate
                "employees.documents.view",     // profile documents tab
                "attendance.view",              // attendance management grid
                "attendance.edit",              // record correction
                "attendance.manual_entry",      // HR manual entry form
                "evaluations.view",             // employees performance drill-in
                "recruitment.view",             // vacancy requests board + newcomers queue
                "recruitment.vacancy_request.create",
                "schedule.view",                // branch schedule
                "schedule.manage",              // publish shift cycles
                "requests.view",                // requests tab on a profile
                // Matrix convergence: hiring (employees.create), profile editing
                // (employees.edit), document uploads (employees.documents.manage)
                // and offboarding (employees.offboard) are HR/HRM-only — the BM
                // keeps the operational bundle (views, status change, attendance,
                // schedule, evaluation drill-in, on-behalf flows).
            ],
        };

        private static async Task EnsurePresetRolePermissionsAsync(ReviveHrDbContext db)
        {
            foreach (var (roleName, keys) in PresetRolePermissionKeys)
            {
                var role = await db.Roles.FirstOrDefaultAsync(r => r.Name == roleName);
                if (role is null)
                {
                    continue;
                }

                var existingKeys = (await db.RolePermissions
                    .Where(rp => rp.RoleId == role.Id)
                    .Join(db.Permissions, rp => rp.PermissionId, p => p.Id, (rp, p) => p.Key)
                    .ToListAsync())
                    .ToHashSet(StringComparer.Ordinal);

                foreach (var key in keys)
                {
                    if (existingKeys.Contains(key))
                    {
                        continue;
                    }

                    var permission = await db.Permissions.FirstOrDefaultAsync(p => p.Key == key);
                    if (permission is null)
                    {
                        continue;
                    }

                    db.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permission.Id });
                }
            }

            await db.SaveChangesAsync();
        }

        /// <summary>Assigns a preset role to a user for one gym (idempotent).</summary>
        internal static async Task EnsureUserGymRoleAsync(ReviveHrDbContext db, int userId, int gymId, string roleName)
        {
            var role = await db.Roles.FirstOrDefaultAsync(r => r.Name == roleName);
            if (role is null)
            {
                return;
            }

            var exists = await db.UserGymRoles.AnyAsync(
                ugr => ugr.UserId == userId && ugr.GymId == gymId && ugr.RoleId == role.Id);
            if (exists)
            {
                return;
            }

            // A user holds at most one role per gym: a new assignment replaces the old one.
            var current = await db.UserGymRoles
                .Where(ugr => ugr.UserId == userId && ugr.GymId == gymId)
                .ToListAsync();
            db.UserGymRoles.RemoveRange(current);

            db.UserGymRoles.Add(new UserGymRole { UserId = userId, GymId = gymId, RoleId = role.Id });
            await db.SaveChangesAsync();
        }

        /// <summary>
        /// Grants a user a system role (UserRoles — the permission-key carrier,
        /// distinct from the per-gym role in UserGymRoles which only carries data
        /// scope). Idempotent.
        /// </summary>
        private static async Task EnsureUserRoleAsync(ReviveHrDbContext db, int userId, string roleName)
        {
            var role = await db.Roles.FirstOrDefaultAsync(r => r.Name == roleName);
            if (role is null)
            {
                return;
            }

            var exists = await db.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.RoleId == role.Id);
            if (exists)
            {
                return;
            }

            db.UserRoles.Add(new UserRole { UserId = userId, RoleId = role.Id });
            await db.SaveChangesAsync();
        }

        private static async Task<User> EnsureUserAsync(
            ReviveHrDbContext db, IPasswordHasher hasher, string email, string userName, UserType userType)
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user is not null)
            {
                return user;
            }

            user = new User
            {
                Email = email,
                UserName = userName,
                PasswordHash = hasher.Hash(EmployeePassword),
                UserType = userType,
                IsActive = true
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return user;
        }

        private static async Task<Gym> EnsureGymAsync(ReviveHrDbContext db, string name, string location)
        {
            var gym = await db.Gyms.FirstOrDefaultAsync(g => g.Name == name);
            if (gym is not null)
            {
                // Backfill the mock's 10% raise policy on gyms seeded before it existed,
                // so the payroll page's "Annual Increase (10%)" row has data to show.
                if (gym.AnnualIncreasePercent is null)
                {
                    gym.AnnualIncreasePercent = 10m;
                    await db.SaveChangesAsync();
                }
                return gym;
            }

            gym = new Gym
            {
                Name = name,
                Location = location,
                ShiftCycleLengthDays = 10,
                Status = GymStatus.Active,
                AnnualIncreasePercent = 10m
            };
            db.Gyms.Add(gym);
            await db.SaveChangesAsync();
            return gym;
        }

        private static async Task EnsureGymAccessAsync(ReviveHrDbContext db, int userId, int gymId)
        {
            if (await db.UserGymAccesses.AnyAsync(a => a.UserId == userId && a.GymId == gymId))
            {
                return;
            }

            db.UserGymAccesses.Add(new UserGymAccess { UserId = userId, GymId = gymId });
            await db.SaveChangesAsync();
        }

        /// <summary>
        /// Ensures the gym has an active station code, generating a fresh random
        /// unique 6-digit code when none exists. Returns the active code so
        /// callers (logs, test fixtures) can read the live value — nothing is
        /// ever hardcoded. <paramref name="lifetimeMinutes"/> is null by default,
        /// which keeps seeded codes valid indefinitely for development use.
        /// </summary>
        private static async Task<string> EnsureStationCodeAsync(
            ReviveHrDbContext db, int gymId, int generatedBy, int? lifetimeMinutes, ILogger logger)
        {
            var existing = await db.StationCodes
                .FirstOrDefaultAsync(sc => sc.GymId == gymId && sc.IsActive);
            if (existing is not null)
            {
                return existing.Code;
            }

            var generatedAt = DateTime.UtcNow;
            var code = await GenerateUniqueStationCodeAsync(db);
            db.StationCodes.Add(new StationCode
            {
                GymId = gymId,
                Code = code,
                IsActive = true,
                GeneratedAt = generatedAt,
                ExpiresAtUtc = lifetimeMinutes.HasValue ? generatedAt.AddMinutes(lifetimeMinutes.Value) : null,
                GeneratedBy = generatedBy
            });
            await db.SaveChangesAsync();
            logger.LogWarning("Seeded station code {Code} for gym {GymId} (development only — generated, not hardcoded)", code, gymId);
            return code;
        }

        private static async Task<string> GenerateUniqueStationCodeAsync(ReviveHrDbContext db)
        {
            for (var attempt = 0; attempt < 20; attempt++)
            {
                var candidate = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
                if (!await db.StationCodes.AnyAsync(sc => sc.Code == candidate))
                {
                    return candidate;
                }
            }

            throw new InvalidOperationException("Could not generate a unique station code while seeding.");
        }

        private static async Task<Position> EnsurePositionAsync(ReviveHrDbContext db, int gymId, string title)
        {
            var position = await db.Positions.FirstOrDefaultAsync(p => p.GymId == gymId && p.Title == title);
            if (position is not null)
            {
                return position;
            }

            position = new Position { GymId = gymId, Title = title, Level = "1", IsActive = true };
            db.Positions.Add(position);
            await db.SaveChangesAsync();
            return position;
        }

        private static async Task<ShiftTemplate> EnsureShiftTemplateAsync(ReviveHrDbContext db, int gymId)
        {
            var template = await db.ShiftTemplates.FirstOrDefaultAsync(t => t.GymId == gymId && t.Name == "Morning Shift");
            if (template is not null)
            {
                return template;
            }

            template = new ShiftTemplate
            {
                GymId = gymId,
                Name = "Morning Shift",
                StartTime = new TimeOnly(8, 0),
                EndTime = new TimeOnly(16, 0),
                IsActive = true
            };
            db.ShiftTemplates.Add(template);
            await db.SaveChangesAsync();
            return template;
        }

        private static async Task<ShiftCycle> EnsureCycleAsync(ReviveHrDbContext db, int gymId, DateOnly today, int adminId)
        {
            var cycle = await db.ShiftCycles.FirstOrDefaultAsync(c =>
                c.GymId == gymId && c.StartDate <= today && c.EndDate >= today);
            if (cycle is not null)
            {
                return cycle;
            }

            cycle = new ShiftCycle
            {
                GymId = gymId,
                StartDate = today,
                EndDate = today.AddDays(9),
                Status = ShiftCycleStatus.Published,
                PublishedAt = DateTime.UtcNow,
                PublishedBy = adminId
            };
            db.ShiftCycles.Add(cycle);
            await db.SaveChangesAsync();
            return cycle;
        }

        /// <summary>
        /// One Open payroll period for the current month at the gym, with Draft
        /// entries for each of its active employees — the manual-testing fixture
        /// that makes every settlement-sheet endpoint (bonus, deductions, close,
        /// publish, payslips, export, review queue) exercisable in Swagger.
        /// Idempotent: existing periods/entries are left untouched.
        /// </summary>
        private static async Task EnsurePayrollSeedAsync(ReviveHrDbContext db, int gymId, DateOnly today)
        {
            var monthStart = new DateOnly(today.Year, today.Month, 1);
            var monthEnd = new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));

            var period = await db.PayrollPeriods
                .FirstOrDefaultAsync(p => p.GymId == gymId && p.StartDate == monthStart);
            if (period is null)
            {
                period = new PayrollPeriod
                {
                    GymId = gymId,
                    StartDate = monthStart,
                    EndDate = monthEnd,
                    Status = PayrollPeriodStatus.Open,
                };
                db.PayrollPeriods.Add(period);
                await db.SaveChangesAsync();
            }

            var employees = await db.Employees
                .Where(e => e.GymId == gymId && e.Status == EmployeeStatus.Active)
                .Select(e => e.Id)
                .ToListAsync();
            if (employees.Count == 0)
            {
                return;
            }

            var existing = await db.PayrollEntries
                .Where(e => e.PayrollPeriodId == period.Id)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            foreach (var employeeId in employees.Where(id => !existing.Contains(id)))
            {
                // 8000 base / 21 days / no OT or bonus — money is recomputed
                // server-side, these columns only seed the starting sheet.
                db.PayrollEntries.Add(new PayrollEntry
                {
                    PayrollPeriodId = period.Id,
                    EmployeeId = employeeId,
                    BaseSalary = 8000m,
                    TotalDeductions = 0m,
                    TotalBonuses = 0m,
                    NetPay = 8000m,
                    DaysWorked = 21,
                    OvertimeHours = 0m,
                    Status = "Draft",
                });
            }

            await db.SaveChangesAsync();
        }

        /// <summary>
        /// Gives a demo employee a base-salary row when he has no compensation yet.
        /// Existing rows are left untouched so a seeded raise/history survives restarts.
        /// </summary>
        private static async Task EnsureCompensationAsync(
            ReviveHrDbContext db, int employeeId, int changedBy, decimal amount, DateOnly today)
        {
            if (await db.Compensations.AnyAsync(c => c.EmployeeId == employeeId && c.Amount > 0))
            {
                return;
            }

            db.Compensations.Add(new Compensation
            {
                EmployeeId = employeeId,
                Amount = amount,
                Currency = "EGP",
                EffectiveDate = new DateOnly(today.Year, 1, 1),
                ChangedBy = changedBy,
                Reason = "Base salary",
            });
            await db.SaveChangesAsync();
        }

        private static async Task<(Employee Employee, User User)> EnsureEmployeeAsync(
            ReviveHrDbContext db, IPasswordHasher hasher,
            string email, string userName, string fullName, string employeeNumber,
            int gymId, int positionId, UserType userType = UserType.Employee)
        {
            var user = await EnsureUserAsync(db, hasher, email, userName, userType);
            var employee = await db.Employees.FirstOrDefaultAsync(e => e.EmployeeNumber == employeeNumber);
            if (employee is not null)
            {
                return (employee, user);
            }

            var hireDate = DateOnly.FromDateTime(DateTime.Now.AddDays(-30));
            employee = new Employee
            {
                UserId = user.Id,
                GymId = gymId,
                PositionId = positionId,
                FullName = fullName,
                EmployeeNumber = employeeNumber,
                HireDate = hireDate,
                ContractType = "FullTime",
                ContractStartDate = hireDate,
                Status = EmployeeStatus.Active
            };
            db.Employees.Add(employee);
            await db.SaveChangesAsync();
            return (employee, user);
        }

        private static async Task<Team> EnsureTeamAsync(ReviveHrDbContext db, int gymId, string name)
        {
            var team = await db.Teams.FirstOrDefaultAsync(t => t.GymId == gymId && t.Name == name);
            if (team is not null)
            {
                return team;
            }

            team = new Team { GymId = gymId, Name = name, IsActive = true };
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team;
        }

        /// <summary>Marks one employee as the leader of a team (idempotent).</summary>
        private static async Task EnsureTeamLeaderAsync(ReviveHrDbContext db, int teamId, int employeeId)
        {
            var exists = await db.TeamLeaders.AnyAsync(tl => tl.TeamId == teamId && tl.EmployeeId == employeeId);
            if (exists)
            {
                return;
            }

            db.TeamLeaders.Add(new TeamLeader { TeamId = teamId, EmployeeId = employeeId });
            await db.SaveChangesAsync();
        }

        private static async Task EnsureAssignmentAsync(
            ReviveHrDbContext db, int cycleId, int employeeId, DateOnly date, int templateId)
        {
            if (await db.ShiftAssignments.AnyAsync(a => a.EmployeeId == employeeId && a.Date == date))
            {
                return;
            }

            db.ShiftAssignments.Add(new ShiftAssignment
            {
                ShiftCycleId = cycleId,
                EmployeeId = employeeId,
                Date = date,
                ShiftTemplateId = templateId
            });
            await db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------
        // Payroll month story (mock §8): a published previous month with a rich
        // sheet (bonus, overtime, deductions), the still-open current month, and
        // the leave/attendance facts the expanded breakdown displays.
        // ------------------------------------------------------------------

        /// <summary>
        /// Karim's demo attendance story per seeded month — gym-local wall-clock
        /// times (stored as the UTC instant the configured timezone places them at,
        /// so the app renders 09:20, not the raw value). The previous month carries
        /// the paid sheet's 3 lates + 3 unapproved absences; the current month the
        /// live days the open sheet prices into pending candidates.
        /// </summary>
        private static readonly (int DayOffset, AttendanceStatus Status, TimeOnly? In, TimeOnly? Out)[] PreviousMonthPlan =
        [
            (0, AttendanceStatus.OnTime, new TimeOnly(8, 2), new TimeOnly(16, 5)),
            (7, AttendanceStatus.Late, new TimeOnly(9, 20), new TimeOnly(16, 10)),
            (8, AttendanceStatus.Late, new TimeOnly(9, 12), new TimeOnly(16, 0)),
            (9, AttendanceStatus.Late, new TimeOnly(9, 5), new TimeOnly(16, 0)),
            (12, AttendanceStatus.EarlyCheckout, new TimeOnly(8, 0), new TimeOnly(13, 30)),
            (17, AttendanceStatus.Absent, null, null),
            (24, AttendanceStatus.Absent, null, null),
            (25, AttendanceStatus.Absent, null, null),
        ];

        private static readonly (int DayOffset, AttendanceStatus Status, TimeOnly? In, TimeOnly? Out)[] CurrentMonthPlan =
        [
            (4, AttendanceStatus.OnTime, new TimeOnly(8, 2), new TimeOnly(16, 5)),
            (11, AttendanceStatus.Late, new TimeOnly(9, 20), new TimeOnly(16, 10)),
            (18, AttendanceStatus.Late, new TimeOnly(9, 5), new TimeOnly(16, 0)),
            (20, AttendanceStatus.Absent, null, null),
        ];

        private static async Task EnsurePayrollAsync(
            ReviveHrDbContext db,
            Gym gym1, Gym gym2,
            Employee karim, Employee omar, Employee sara,
            int hrManagerUserId, DateOnly today, TimeZoneInfo attendanceTimeZone)
        {
            var prevMonth = today.AddMonths(-1);
            var prevStart = new DateOnly(prevMonth.Year, prevMonth.Month, 1);
            var prevEnd = prevStart.AddMonths(1).AddDays(-1);
            var currentStart = new DateOnly(today.Year, today.Month, 1);
            var currentEnd = currentStart.AddMonths(1).AddDays(-1);

            // 1) Previous month — published & paid, only when the gym has no
            //    closed period overlapping it (an HR-run period is left untouched).
            if (!await db.PayrollPeriods.AnyAsync(p =>
                    p.GymId == gym1.Id && p.Status != PayrollPeriodStatus.Open
                    && p.StartDate <= prevEnd && p.EndDate >= prevStart))
            {
                var published = new PayrollPeriod
                {
                    GymId = gym1.Id,
                    StartDate = prevStart,
                    EndDate = prevEnd,
                    Status = PayrollPeriodStatus.Locked,
                    ApprovedBy = hrManagerUserId,
                    ApprovedAt = DateTime.UtcNow,
                    PaidDate = prevEnd
                };
                db.PayrollPeriods.Add(published);
                await db.SaveChangesAsync();

                // Karim — the full story: bonus, overtime, late/absence/advance deductions.
                const decimal karimBase = 7000m;
                const decimal karimBonus = 500m;
                const decimal karimOvertimePay = 159.09m; // 7000/176 × 1.5 × 4h
                const decimal karimDeductions = 650m;
                var karimEntry = new PayrollEntry
                {
                    PayrollPeriodId = published.Id,
                    EmployeeId = karim.Id,
                    BaseSalary = karimBase,
                    TotalBonuses = karimBonus,
                    TotalDeductions = karimDeductions,
                    NetPay = karimBase + karimBonus + karimOvertimePay - karimDeductions,
                    DaysWorked = 23,
                    OvertimeHours = 4,
                    Status = "Locked",
                    ReviewedAt = DateTime.UtcNow
                };
                db.PayrollEntries.Add(karimEntry);
                await db.SaveChangesAsync();

                var mid = prevStart.AddDays(9);
                db.PayrollEntryLineItems.AddRange(
                    new PayrollEntryLineItem
                    {
                        PayrollEntryId = karimEntry.Id, Type = "Earning", Label = "Overtime Pay",
                        EffectiveDate = mid, Amount = karimOvertimePay, Source = "Manual",
                        Reason = "4h overtime at 1.5×", Status = "Approved"
                    },
                    new PayrollEntryLineItem
                    {
                        PayrollEntryId = karimEntry.Id, Type = "Earning", Label = "Performance Bonus",
                        EffectiveDate = mid, Amount = karimBonus, Source = "Manual",
                        Reason = "Outstanding member feedback", Status = "Approved"
                    },
                    new PayrollEntryLineItem
                    {
                        PayrollEntryId = karimEntry.Id, Type = "Deduction", Label = "Late Arrival Deduction",
                        EffectiveDate = mid, Amount = -50m, Source = "Manual",
                        Reason = "3 late arrivals this period", Status = "Accepted"
                    },
                    new PayrollEntryLineItem
                    {
                        PayrollEntryId = karimEntry.Id, Type = "Deduction", Label = "Unapproved Absence (3 days)",
                        EffectiveDate = mid, Amount = -100m, Source = "Manual",
                        Reason = "Absent without permission — auto-raised", Status = "Accepted"
                    },
                    new PayrollEntryLineItem
                    {
                        PayrollEntryId = karimEntry.Id, Type = "Deduction", Label = "Salary Advance Repayment",
                        EffectiveDate = mid, Amount = -500m, Source = "Manual",
                        Reason = "July salary advance repaid", Status = "Accepted"
                    });

                // Omar — a clean month for contrast.
                db.PayrollEntries.Add(new PayrollEntry
                {
                    PayrollPeriodId = published.Id,
                    EmployeeId = omar.Id,
                    BaseSalary = 9000m,
                    TotalBonuses = 300m,
                    TotalDeductions = 0m,
                    NetPay = 9300m,
                    DaysWorked = 25,
                    Status = "Locked",
                    ReviewedAt = DateTime.UtcNow
                });
                await db.SaveChangesAsync();

                var omarEntry = db.PayrollEntries.Local
                    .First(e => e.PayrollPeriodId == published.Id && e.EmployeeId == omar.Id);
                db.PayrollEntryLineItems.Add(new PayrollEntryLineItem
                {
                    PayrollEntryId = omarEntry.Id, Type = "Earning", Label = "Team Bonus",
                    EffectiveDate = mid, Amount = 300m, Source = "Manual",
                    Reason = "Branch targets met", Status = "Approved"
                });
                await db.SaveChangesAsync();
            }

            // Same published month for gym2 so Sara's payroll page is not empty.
            if (!await db.PayrollPeriods.AnyAsync(p =>
                    p.GymId == gym2.Id && p.Status != PayrollPeriodStatus.Open
                    && p.StartDate <= prevEnd && p.EndDate >= prevStart))
            {
                var published2 = new PayrollPeriod
                {
                    GymId = gym2.Id,
                    StartDate = prevStart,
                    EndDate = prevEnd,
                    Status = PayrollPeriodStatus.Locked,
                    ApprovedBy = hrManagerUserId,
                    ApprovedAt = DateTime.UtcNow,
                    PaidDate = prevEnd
                };
                db.PayrollPeriods.Add(published2);
                await db.SaveChangesAsync();

                db.PayrollEntries.Add(new PayrollEntry
                {
                    PayrollPeriodId = published2.Id,
                    EmployeeId = sara.Id,
                    BaseSalary = 6000m,
                    TotalBonuses = 0m,
                    TotalDeductions = 0m,
                    NetPay = 6000m,
                    DaysWorked = 24,
                    Status = "Locked",
                    ReviewedAt = DateTime.UtcNow
                });
                await db.SaveChangesAsync();
            }

            // 2) Current month — the still-open "Current Period / Processing" sheet.
            if (!await db.PayrollPeriods.AnyAsync(p =>
                    p.GymId == gym1.Id && p.Status == PayrollPeriodStatus.Open
                    && p.StartDate <= currentEnd && p.EndDate >= currentStart))
            {
                var open = new PayrollPeriod
                {
                    GymId = gym1.Id,
                    StartDate = currentStart,
                    EndDate = currentEnd,
                    Status = PayrollPeriodStatus.Open
                };
                db.PayrollPeriods.Add(open);
                await db.SaveChangesAsync();

                db.PayrollEntries.Add(new PayrollEntry
                {
                    PayrollPeriodId = open.Id,
                    EmployeeId = karim.Id,
                    BaseSalary = 7000m,
                    TotalBonuses = 0m,
                    TotalDeductions = 0m,
                    NetPay = 7000m,
                    DaysWorked = 0,
                    Status = "Draft"
                });
                await db.SaveChangesAsync();
            }

            // 3) Approved leave Karim took during the previous month — idempotent
            //    per (employee, type, date) so an already-seeded month is skipped.
            await EnsureApprovedLeaveAsync(db, karim.Id, "Annual Leave",
                prevStart.AddDays(4), prevStart.AddDays(5), "Family visit", hrManagerUserId);
            await EnsureApprovedLeaveAsync(db, karim.Id, "Sick Leave",
                prevStart.AddDays(11), prevStart.AddDays(11), "Flu — certificate provided", hrManagerUserId);

            // 4) Karim's leave balances for this year reflect the taken days
            //    (rows are only created when the type has none yet).
            await EnsureLeaveBalanceAsync(db, karim.Id, LeaveType.Annual, 21m, usedDays: 2m);
            await EnsureLeaveBalanceAsync(db, karim.Id, LeaveType.Sick, 10m, usedDays: 1m);

            // 5) The attendance facts behind the seeded deductions — only when
            //    Karim has no records at all in the previous month. Planned local
            //    times are stored as true UTC (LocalUtcAt), so the app's gym-local
            //    display renders the intended clock (09:20 arrival, not 12:20).
            if (!await db.AttendanceRecords.AnyAsync(a =>
                    a.EmployeeId == karim.Id && a.Date >= prevStart && a.Date <= prevEnd))
            {
                var prevTemplate = await EnsureShiftTemplateAsync(db, gym1.Id);
                foreach (var (offset, status, inTime, outTime) in PreviousMonthPlan)
                {
                    var date = prevStart.AddDays(offset);
                    db.AttendanceRecords.Add(new AttendanceRecord
                    {
                        EmployeeId = karim.Id, GymId = gym1.Id, Date = date,
                        CheckInTime = inTime is null ? null : LocalUtcAt(date, inTime.Value, attendanceTimeZone),
                        CheckOutTime = outTime is null ? null : LocalUtcAt(date, outTime.Value, attendanceTimeZone),
                        Status = status,
                        // Every scheduled day carries its shift window (late rows price
                        // against its start; all rows can render the day's shift).
                        ScheduledShiftTemplateId = prevTemplate.Id,
                    });
                }
                await db.SaveChangesAsync();
            }

            // Per-day history for the paid month (lump lines → one priced line per
            //    late/absent day) plus live exceptions for the open one, so both sheets
            //    show what a late arrival / unapproved absence actually costs.
            await EnsurePerDayDeductionHistoryAsync(db, karim.Id, gym1.Id, hrManagerUserId, prevStart, prevEnd, attendanceTimeZone);
            await EnsureCurrentMonthAttendanceAsync(db, karim.Id, gym1.Id, currentStart, currentEnd, today, attendanceTimeZone);
        }

        /// <summary>
        /// Repairs karim's paid month so every late/absent day carries its own priced
        /// deduction line (mock §8), no matter how the sheet got here:
        ///   • legacy lump lines ("Late Arrival Deduction" / "Unapproved Absence (3 days)")
        ///     are removed — the per-day lines below replace them;
        ///   • each late/absent day without a line gets one (Accepted) priced like the
        ///     live flow — base ÷ 30 calendar days, a quarter day per late arrival, one
        ///     day per unapproved absence — plus its applied candidate;
        ///   • seed-shaped attendance rows (this seeder's own demo facts — never
        ///     user-entered, which always carry a method/note/station session) get the
        ///     shift link and the planned local clock times stored as true UTC.
        /// Totals are recomputed only when something actually changed; idempotent.
        /// </summary>
        private static async Task EnsurePerDayDeductionHistoryAsync(
            ReviveHrDbContext db, int employeeId, int gymId, int issuedById,
            DateOnly paidStart, DateOnly paidEnd, TimeZoneInfo timeZone)
        {
            var entry = await db.PayrollEntries
                .Include(e => e.PayrollPeriod)
                .FirstOrDefaultAsync(e => e.EmployeeId == employeeId
                    && e.PayrollPeriod!.Status != PayrollPeriodStatus.Open
                    && e.PayrollPeriod.StartDate <= paidEnd && e.PayrollPeriod.EndDate >= paidStart);
            if (entry is null)
            {
                return; // no closed sheet for the paid month yet
            }

            var records = await db.AttendanceRecords
                .Where(a => a.EmployeeId == employeeId
                    && a.Date >= entry.PayrollPeriod!.StartDate && a.Date <= entry.PayrollPeriod.EndDate)
                .OrderBy(a => a.Date)
                .ToListAsync();
            if (records.Count == 0)
            {
                return; // nothing to itemize
            }

            var changed = false;

            // Seed-shaped rows re-store the planned local times as true UTC (older
            // seeds wrote wall-clock values straight into the timestamptz column, so
            // 09:20 rendered as 12:20 gym-local). Re-running stores the same instants,
            // so the repair never shifts a second time.
            foreach (var record in records)
            {
                if (record.CheckInMethod is not null || record.CheckOutMethod is not null
                    || record.Notes is not null || record.StationSessionId is not null)
                {
                    continue; // entered through the app — leave the facts alone
                }

                var dayOffset = record.Date.DayNumber - entry.PayrollPeriod.StartDate.DayNumber;
                var planned = PreviousMonthPlan.FirstOrDefault(p => p.DayOffset == dayOffset);
                if (planned.DayOffset != dayOffset || planned.Status != record.Status)
                {
                    continue;
                }

                var checkIn = planned.In is null ? (DateTime?)null : LocalUtcAt(record.Date, planned.In.Value, timeZone);
                var checkOut = planned.Out is null ? (DateTime?)null : LocalUtcAt(record.Date, planned.Out.Value, timeZone);
                if (record.CheckInTime != checkIn || record.CheckOutTime != checkOut)
                {
                    record.CheckInTime = checkIn;
                    record.CheckOutTime = checkOut;
                    changed = true;
                }
            }

            var template = await EnsureShiftTemplateAsync(db, gymId);
            var pricedDays = records
                .Where(r => r.Status is AttendanceStatus.Late or AttendanceStatus.Absent)
                .OrderBy(r => r.Date)
                .ToList();

            // Legacy lump late/absence lines are superseded by the per-day lines.
            var lumpLines = await db.PayrollEntryLineItems
                .Where(l => l.PayrollEntryId == entry.Id
                    && (l.Label == "Late Arrival Deduction" || l.Label == "Unapproved Absence (3 days)"))
                .ToListAsync();
            if (lumpLines.Count > 0)
            {
                db.PayrollEntryLineItems.RemoveRange(lumpLines);
                changed = true;
            }

            // Manual deduction lines (salary advance, seeded adjustments) never
            // materialized from a candidate — the migration's date backfill could
            // still match one, so drop that link before any HR reprice follows it.
            foreach (var manualLine in await db.PayrollEntryLineItems
                         .Where(l => l.PayrollEntryId == entry.Id
                             && l.Type == "Deduction"
                             && l.DeductionCandidateId != null
                             && l.Source == "Manual")
                         .ToListAsync())
            {
                manualLine.DeductionCandidateId = null;
                changed = true;
            }

            var linesByRecord = (await db.PayrollEntryLineItems
                    .Where(l => l.PayrollEntryId == entry.Id && l.AttendanceRecordId != null)
                    .ToListAsync())
                .GroupBy(l => l.AttendanceRecordId!.Value)
                .ToDictionary(g => g.Key, g => g.First());
            var candidatesByRecord = (await db.DeductionCandidates
                    .Where(c => c.EmployeeId == employeeId && c.AttendanceRecordId != null)
                    .ToListAsync())
                .GroupBy(c => c.AttendanceRecordId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            // The live pricing rule (DeductionPricing): a fixed 30-day month, a
            // quarter day per late arrival and one day per unapproved absence.
            var daily = Math.Round(entry.BaseSalary / 30m, 2);
            var lateAmount = Math.Round(daily / 4m, 2);
            // One unexcused absence costs one day of pay.
            var absenceAmount = Math.Round(daily * 1m, 2);

            foreach (var record in pricedDays)
            {
                // The day's shift powers the payslip's per-day facts (window + minutes late).
                if (record.ScheduledShiftTemplateId is null)
                {
                    record.ScheduledShiftTemplateId = template.Id;
                    changed = true;
                }

                candidatesByRecord.TryGetValue(record.Id, out var existing);
                if (existing?.Any(c => c.Status == DeductionStatus.Rejected) == true)
                {
                    continue; // the branch rejected this day's deduction — respect it
                }

                var isLate = record.Status == AttendanceStatus.Late;
                var amount = isLate ? lateAmount : absenceAmount;
                var days = isLate ? 0.25m : 1m;
                var label = isLate
                    ? $"Late Arrival — {record.Date:MMM d}"
                    : $"Unapproved Absence — {record.Date:MMM d}";
                var note = isLate
                    ? $"Auto-priced: quarter day (base ÷ 30 calendar days ÷ 4)."
                    : $"Auto-priced: 1 days (base ÷ 30 calendar days × 1).";

                linesByRecord.TryGetValue(record.Id, out var line);
                if (line is null)
                {
                    line = new PayrollEntryLineItem
                    {
                        PayrollEntryId = entry.Id,
                        Type = "Deduction",
                        Label = label,
                        EffectiveDate = record.Date,
                        // Deduction lines carry a positive amount (the totals subtract it).
                        Amount = amount,
                        Source = "biometric",
                        Reason = note,
                        AttendanceRecordId = record.Id,
                        Status = "Accepted",
                    };
                    db.PayrollEntryLineItems.Add(line);
                    linesByRecord[record.Id] = line;
                    changed = true;
                }
                else if (line.Status is not "Rejected"
                    && line.Source == "biometric"
                    && line.Reason?.StartsWith("Auto-priced:", StringComparison.Ordinal) == true)
                {
                    // The three-day absence rule changed the price of the seeded
                    // per-day lines — keep demos and the code in agreement.
                    if (line.Amount != amount) { line.Amount = amount; changed = true; }
                    if (line.Reason != note) { line.Reason = note; changed = true; }
                    if (line.Label != label) { line.Label = label; changed = true; }
                }

                var candidate = existing?
                    .Where(c => c.Status != DeductionStatus.Rejected)
                    .OrderBy(c => c.Status == DeductionStatus.Approved ? 0 : 1)
                    .FirstOrDefault();
                if (candidate is null)
                {
                    candidate = new DeductionCandidate
                    {
                        EmployeeId = employeeId,
                        AttendanceRecordId = record.Id,
                        DeductionDate = record.Date,
                        DeductionDays = days,
                        IsSystemGenerated = true,
                        Amount = amount,
                        Reason = isLate ? "Late arrival" : "Unapproved absence",
                        Note = note,
                        IssuedBy = issuedById,
                        IssuedAt = LocalUtcAt(record.Date, new TimeOnly(12, 0), timeZone),
                        Status = DeductionStatus.Approved,
                        ReviewedBy = issuedById,
                        ReviewedAt = DateTime.UtcNow,
                    };
                    db.DeductionCandidates.Add(candidate);
                    changed = true;
                }
                else if (candidate.IsSystemGenerated
                    || candidate.Note?.StartsWith("Auto-priced:", StringComparison.Ordinal) == true)
                {
                    var dirty = false;
                    if (!candidate.IsSystemGenerated) { candidate.IsSystemGenerated = true; dirty = true; }
                    if (candidate.DeductionDate != record.Date) { candidate.DeductionDate = record.Date; dirty = true; }
                    if (candidate.DeductionDays != days) { candidate.DeductionDays = days; dirty = true; }
                    if (candidate.Amount != amount) { candidate.Amount = amount; dirty = true; }
                    if (candidate.Note != note) { candidate.Note = note; dirty = true; }
                    var reason = isLate ? "Late arrival" : "Unapproved absence";
                    if (candidate.Reason != reason) { candidate.Reason = reason; dirty = true; }
                    changed |= dirty;
                }

                // The payroll line materialized from the candidate — link them so an
                // HR re-price on the sheet also updates the employee-facing row.
                if (line.DeductionCandidateId != candidate.Id)
                {
                    if (candidate.Id > 0)
                    {
                        line.DeductionCandidateId = candidate.Id;
                    }
                    else
                    {
                        line.DeductionCandidate = candidate;
                    }

                    changed = true;
                }
            }

            if (!changed)
            {
                return; // already repaired by an earlier run
            }

            // Flush the line swap before recomputing from the database — the flip
            // loop and the totals sum below must see the per-day lines, not the
            // pending-removed lumps.
            await db.SaveChangesAsync();

            // The remaining deduction lines (salary advance, manual branches) flip to
            // the service's positive-amount convention while this sheet is rewritten.
            foreach (var legacyLine in await db.PayrollEntryLineItems
                         .Where(l => l.PayrollEntryId == entry.Id && l.Type == "Deduction" && l.Amount < 0)
                         .ToListAsync())
            {
                legacyLine.Amount = -legacyLine.Amount;
            }

            entry.TotalDeductions = await db.PayrollEntryLineItems
                .Where(l => l.PayrollEntryId == entry.Id && l.Type == "Deduction"
                    && (l.Status == "Accepted" || l.Status == "Approved"))
                .SumAsync(l => Math.Abs(l.Amount));
            var overtime = entry.OvertimeHours > 0
                ? Math.Round(entry.BaseSalary / 176m * 1.5m * entry.OvertimeHours, 2)
                : 0m;
            entry.NetPay = entry.BaseSalary + entry.TotalBonuses + overtime - entry.TotalDeductions;
            await db.SaveChangesAsync();
        }

        /// <summary>
        /// Karim's current-month attendance (the open sheet prices these days into
        /// pending candidates when read) and the open entry's worked-day count — only
        /// when the month has no records yet, and never in the future.
        /// </summary>
        private static async Task EnsureCurrentMonthAttendanceAsync(
            ReviveHrDbContext db, int employeeId, int gymId,
            DateOnly monthStart, DateOnly monthEnd, DateOnly today, TimeZoneInfo timeZone)
        {
            if (await db.AttendanceRecords.AnyAsync(a =>
                    a.EmployeeId == employeeId && a.Date >= monthStart && a.Date <= monthEnd))
            {
                return;
            }

            var template = await EnsureShiftTemplateAsync(db, gymId);

            var added = 0;
            foreach (var (offset, status, inTime, outTime) in CurrentMonthPlan)
            {
                var date = monthStart.AddDays(offset);
                if (date > today || date > monthEnd)
                {
                    continue;
                }

                db.AttendanceRecords.Add(new AttendanceRecord
                {
                    EmployeeId = employeeId,
                    GymId = gymId,
                    Date = date,
                    // Planned local times stored as true UTC, so the app's gym-local
                    // display renders the intended clock (08:15 check-in, 15 min late).
                    CheckInTime = inTime is null ? null : LocalUtcAt(date, inTime.Value, timeZone),
                    CheckOutTime = outTime is null ? null : LocalUtcAt(date, outTime.Value, timeZone),
                    Status = status,
                    ScheduledShiftTemplateId = template.Id,
                });
                added++;
            }

            if (added == 0)
            {
                return;
            }

            await db.SaveChangesAsync();

            // Keep the open sheet's "Actual Attendance Days" stat honest.
            var worked = await db.AttendanceRecords.CountAsync(a =>
                a.EmployeeId == employeeId && a.CheckInTime != null
                && a.Date >= monthStart && a.Date <= monthEnd);
            var openEntry = await db.PayrollEntries.FirstOrDefaultAsync(e =>
                e.EmployeeId == employeeId
                && e.PayrollPeriod!.Status == PayrollPeriodStatus.Open
                && e.PayrollPeriod.StartDate <= monthEnd && e.PayrollPeriod.EndDate >= monthStart);
            if (openEntry is not null && openEntry.DaysWorked != worked)
            {
                openEntry.DaysWorked = worked;
                await db.SaveChangesAsync();
            }
        }

        /// <summary>One approved leave request (BM + HR decided), idempotent per (employee, type, date).</summary>
        private static async Task EnsureApprovedLeaveAsync(
            ReviveHrDbContext db, int employeeId, string type,
            DateOnly from, DateOnly to, string details, int decidedByUserId)
        {
            if (await db.EmployeeRequests.AnyAsync(r =>
                    r.EmployeeId == employeeId && r.Type == type && r.RequestDate == from))
            {
                return;
            }

            db.EmployeeRequests.Add(new EmployeeRequest
            {
                EmployeeId = employeeId,
                Type = type,
                RequestDate = from,
                TargetStartDate = from,
                TargetEndDate = to,
                Details = details,
                Status = RequestStatus.Approved,
                Payment = "paid",
                SubmittedAt = UtcAt(from.AddDays(-2), new TimeOnly(9, 0)),
                CreatedAt = UtcAt(from.AddDays(-2), new TimeOnly(9, 0)),
                Decisions =
                [
                    new RequestDecision
                    {
                        RequestId = 0, Stage = ApprovalStage.BranchManager, Decision = DecisionOutcome.Approved,
                        Comment = null, DecidedBy = decidedByUserId,
                        DecidedAt = UtcAt(from.AddDays(-1), new TimeOnly(10, 0))
                    },
                    new RequestDecision
                    {
                        RequestId = 0, Stage = ApprovalStage.HR, Decision = DecisionOutcome.Approved,
                        Comment = "Approved — deducted from balance.", DecidedBy = decidedByUserId,
                        DecidedAt = UtcAt(from, new TimeOnly(11, 0))
                    }
                ]
            });
            await db.SaveChangesAsync();
        }

        /// <summary>PostgreSQL timestamptz columns only accept UTC — DateOnly.ToDateTime is Unspecified.</summary>
        private static DateTime UtcAt(DateOnly date, TimeOnly time)
            => DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Utc);

        /// <summary>Gym-local wall-clock time → the UTC instant the configured timezone places it at (so 09:20 local renders as 09:20, not wall-clock-as-UTC).</summary>
        private static DateTime LocalUtcAt(DateOnly date, TimeOnly time, TimeZoneInfo timeZone)
            => TimeZoneInfo.ConvertTimeToUtc(
                DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Unspecified), timeZone);

        /// <summary>Leave-balance row for the current year, created with the seeded usage when missing.</summary>
        private static async Task EnsureLeaveBalanceAsync(
            ReviveHrDbContext db, int employeeId, LeaveType leaveType, decimal entitlement, decimal usedDays)
        {
            var year = DateTime.UtcNow.Year;
            if (await db.LeaveBalances.AnyAsync(b =>
                    b.EmployeeId == employeeId && b.Year == year && b.LeaveType == leaveType))
            {
                return;
            }

            db.LeaveBalances.Add(new LeaveBalance
            {
                EmployeeId = employeeId,
                LeaveType = leaveType,
                Year = year,
                TotalEntitlement = entitlement,
                UsedDays = usedDays,
                PendingDays = 0
            });
            await db.SaveChangesAsync();
        }
    }
}
