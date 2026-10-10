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
using System.Security.Cryptography;

namespace ReviveHRSystem.Web.DataSeed
{
    /// <summary>
    /// Idempotent Development-only seed so login + attendance are testable end-to-end.
    /// Creates two gyms, three employees covering the ADR-004 validation matrix, a
    /// randomly generated active 6-digit station code per gym, and a published shift
    /// cycle covering today. Also applies pending EF migrations on startup in Development.
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
    ///   EMP-1042 Karim — access: gym1 only, shift at gym1 today
    ///   EMP-1051 Omar  — access: gym1 + gym2, shift at gym1 today (→ WRONG_BRANCH at gym2)
    ///   EMP-1060 Sara  — access: gym2 only, no shift today        (→ SCHEDULED_DAY_OFF at gym2)
    /// </summary>
    public static class DevelopmentDataSeeder
    {
        public const string AdminEmail = "admin@revive.hr";
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

            var admin = await EnsureUserAsync(db, hasher, AdminEmail, "admin", UserType.TopManagement);
            var gym1 = await EnsureGymAsync(db, Gym1Name, "Cairo");
            var gym2 = await EnsureGymAsync(db, Gym2Name, "Alexandria");
            await EnsureGymAccessAsync(db, admin.Id, gym1.Id);
            await EnsureGymAccessAsync(db, admin.Id, gym2.Id);

            var stationCodeLifetimeMinutes = configuration.GetValue<int?>(StationCodeLifetimeKey);
            var gym1StationCode = await EnsureStationCodeAsync(db, gym1.Id, admin.Id, stationCodeLifetimeMinutes, logger);
            var gym2StationCode = await EnsureStationCodeAsync(db, gym2.Id, admin.Id, stationCodeLifetimeMinutes, logger);

            var position1 = await EnsurePositionAsync(db, gym1.Id, "Fitness Trainer");
            var position2 = await EnsurePositionAsync(db, gym2.Id, "Fitness Trainer");

            var template = await EnsureShiftTemplateAsync(db, gym1.Id);

            // Seed today's schedule using the same configured timezone as attendance checks.
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone));
            var cycle1 = await EnsureCycleAsync(db, gym1.Id, today, admin.Id);

            // Karim — gym1 only, shift today at gym1.
            var (karim, karimUser) = await EnsureEmployeeAsync(db, hasher, "karim@revive.hr", "karim",
                "Karim Hassan", "EMP-1042", gym1.Id, position1.Id);
            await EnsureGymAccessAsync(db, karimUser.Id, gym1.Id);
            await EnsureAssignmentAsync(db, cycle1.Id, karim.Id, today, template.Id);

            // Omar — access to both gyms but only scheduled at gym1 today.
            var (omar, omarUser) = await EnsureEmployeeAsync(db, hasher, "omar@revive.hr", "omar",
                "Omar Youssef", "EMP-1051", gym1.Id, position1.Id);
            await EnsureGymAccessAsync(db, omarUser.Id, gym1.Id);
            await EnsureGymAccessAsync(db, omarUser.Id, gym2.Id);
            await EnsureAssignmentAsync(db, cycle1.Id, omar.Id, today, template.Id);

            // Sara — gym2 only, deliberately no shift today.
            var (_, saraUser) = await EnsureEmployeeAsync(db, hasher, "sara@revive.hr", "sara",
                "Sara Ali", "EMP-1060", gym2.Id, position2.Id);
            await EnsureGymAccessAsync(db, saraUser.Id, gym2.Id);

            logger.LogWarning(
                "Development seed complete. Logins: {Admin} / employee accounts (karim@revive.hr, omar@revive.hr, sara@revive.hr) password {Password}. " +
                "Station codes: {Gym1}={Code1}, {Gym2}={Code2} (generated — fetch any time via GET /api/gyms/{{gymId}}/station-codes as an HR/admin user)",
                AdminEmail, EmployeePassword, gym1.Name, gym1StationCode, gym2.Name, gym2StationCode);
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
            int gymId, int positionId)
        {
            var user = await EnsureUserAsync(db, hasher, email, userName, UserType.Employee);
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
