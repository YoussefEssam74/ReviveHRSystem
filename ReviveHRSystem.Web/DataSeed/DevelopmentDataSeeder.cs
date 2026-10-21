using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
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

        public static async Task SeedAsync(IServiceProvider services)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var configuration = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>();
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

            var (hrManagerProfile, hrManager) = await EnsureEmployeeAsync(db, hasher, HrManagerEmail, "hrmanager",
                "Mona Aly", "EMP-1002", gym1.Id, position1.Id, UserType.HR);
            await EnsureGymAccessAsync(db, hrManager.Id, gym1.Id);
            await EnsureGymAccessAsync(db, hrManager.Id, gym2.Id);
            await EnsureUserGymRoleAsync(db, hrManager.Id, gym1.Id, RoleNames.HrManager);
            await EnsureUserGymRoleAsync(db, hrManager.Id, gym2.Id, RoleNames.HrManager);

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
            // per-gym rows above only scope the data.
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
        private static async Task EnsureUserGymRoleAsync(ReviveHrDbContext db, int userId, int gymId, string roleName)
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
                return gym;
            }

            gym = new Gym
            {
                Name = name,
                Location = location,
                ShiftCycleLengthDays = 10,
                Status = GymStatus.Active
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
    }
}
