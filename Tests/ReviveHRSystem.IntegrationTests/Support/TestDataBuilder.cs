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
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ServiceAbstraction.Services;

namespace ReviveHRSystem.IntegrationTests.Support
{
    public sealed record TestGym(int GymId, string StationCode, string Name);

    public sealed record TestEmployee(int EmployeeId, string EmployeeNumber, int UserId, string Email, string Password);

    /// <summary>A login-capable user account with no employee profile (HR, TopManagement, …).</summary>
    public sealed record TestUser(int UserId, string Email, string Password);

    /// <summary>
    /// Per-test data factory. Every test that mutates state creates its own gym /
    /// station code / employees so tests never depend on each other (test isolation).
    /// </summary>
    public sealed class TestDataBuilder
    {
        private readonly ReviveHrDbContext _db;
        private readonly IPasswordHasher _hasher;
        private readonly TimeZoneInfo _attendanceTimeZone;
        private readonly Random _random = new();

        public TestDataBuilder(IServiceProvider services)
        {
            _db = services.GetRequiredService<ReviveHrDbContext>();
            _hasher = services.GetRequiredService<IPasswordHasher>();
            _attendanceTimeZone = services.GetRequiredService<TimeZoneInfo>();
        }

        /// <summary>
        /// Today's date in the app's configured attendance timezone. Shift assignments must
        /// use the same date the service derives from event timestamps, otherwise events
        /// would resolve to "no shift scheduled" around midnight.
        /// </summary>
        public DateOnly AttendanceToday =>
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _attendanceTimeZone));

        public async Task<TestGym> CreateGymWithStationAsync()
        {
            var suffix = UniqueSuffix();
            var gym = new Gym
            {
                Name = $"IT Gym {suffix}",
                Location = "Test",
                ShiftCycleLengthDays = 10,
                Status = GymStatus.Active
            };
            _db.Gyms.Add(gym);
            await _db.SaveChangesAsync();

            var code = await CreateUniqueStationCodeAsync(gym.Id);
            return new TestGym(gym.Id, code, gym.Name);
        }

        /// <summary>
        /// Creates a user + employee. <paramref name="accessGyms"/> controls UserGymAccess rows;
        /// when <paramref name="shiftAtGym"/> is set, a published cycle covering today and a shift
        /// assignment for today are created at that gym.
        /// </summary>
        public async Task<TestEmployee> CreateEmployeeAsync(
            TestGym homeGym,
            IReadOnlyList<TestGym>? accessGyms = null,
            TestGym? shiftAtGym = null,
            string? password = null)
        {
            var suffix = UniqueSuffix();
            var email = $"itest-{suffix}@test.local".ToLowerInvariant();
            var plainPassword = password ?? DevelopmentDataSeederEmployeePassword;

            var user = new User
            {
                Email = email,
                UserName = $"itest-{suffix}".ToLowerInvariant(),
                PasswordHash = _hasher.Hash(DevelopmentDataSeederEmployeePassword),
                UserType = UserType.Employee,
                IsActive = true
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            var position = await _db.Positions.FirstOrDefaultAsync(p => p.GymId == homeGym.GymId && p.Title == "IT Tester")
                ?? new Position { GymId = homeGym.GymId, Title = "IT Tester", Level = "1", IsActive = true };
            if (position.Id == 0)
            {
                _db.Positions.Add(position);
                await _db.SaveChangesAsync();
            }

            var hireDate = DateOnly.FromDateTime(DateTime.Now.AddDays(-7));
            var employeeNumber = $"IT-{suffix}";
            var employee = new Employee
            {
                UserId = user.Id,
                GymId = homeGym.GymId,
                PositionId = position.Id,
                FullName = $"IT Employee {suffix}",
                EmployeeNumber = employeeNumber,
                HireDate = hireDate,
                ContractType = "FullTime",
                ContractStartDate = hireDate,
                Status = EmployeeStatus.Active
            };
            _db.Employees.Add(employee);
            await _db.SaveChangesAsync();

            foreach (var gym in accessGyms ?? new[] { homeGym })
            {
                if (!await _db.UserGymAccesses.AnyAsync(a => a.UserId == user.Id && a.GymId == gym.GymId))
                {
                    _db.UserGymAccesses.Add(new UserGymAccess { UserId = user.Id, GymId = gym.GymId });
                }
            }

            await _db.SaveChangesAsync();

            if (shiftAtGym is not null)
            {
                await AssignShiftTodayAsync(employee.Id, shiftAtGym.GymId);
            }

            return new TestEmployee(employee.Id, employeeNumber, user.Id, email, plainPassword);
        }

        /// <summary>
        /// Creates a login-capable user account with no employee profile, plus the given
        /// UserGymAccess rows — used to authenticate as HR (or any other) principal.
        /// </summary>
        public async Task<TestUser> CreateUserAsync(UserType userType, IReadOnlyList<TestGym> accessGyms, string? password = null)
        {
            var suffix = UniqueSuffix();
            var email = $"ittest-{suffix}@test.local".ToLowerInvariant();
            var plainPassword = password ?? DevelopmentDataSeederEmployeePassword;

            var user = new User
            {
                Email = email,
                UserName = $"ittest-{suffix}".ToLowerInvariant(),
                PasswordHash = _hasher.Hash(plainPassword),
                UserType = userType,
                IsActive = true
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            foreach (var gym in accessGyms)
            {
                if (!await _db.UserGymAccesses.AnyAsync(a => a.UserId == user.Id && a.GymId == gym.GymId))
                {
                    _db.UserGymAccesses.Add(new UserGymAccess { UserId = user.Id, GymId = gym.GymId });
                }
            }

            await _db.SaveChangesAsync();

            return new TestUser(user.Id, email, plainPassword);
        }

        public Task AssignShiftTodayAsync(int employeeId, int gymId) =>
            AssignShiftAsync(employeeId, gymId, AttendanceToday, "IT Morning", new TimeOnly(8, 0), new TimeOnly(16, 0));

        /// <summary>
        /// Publishes a cycle covering <paramref name="date"/> (reusing one when it fits) and
        /// assigns the named template to the employee for that date. Overnight shifts are
        /// supported: pass an EndTime before the StartTime (e.g. 22:00 → 05:00).
        /// </summary>
        public async Task AssignShiftAsync(
            int employeeId,
            int gymId,
            DateOnly date,
            string templateName,
            TimeOnly startTime,
            TimeOnly endTime)
        {
            var template = await _db.ShiftTemplates.FirstOrDefaultAsync(t => t.GymId == gymId && t.Name == templateName)
                ?? new ShiftTemplate
                {
                    GymId = gymId,
                    Name = templateName,
                    StartTime = startTime,
                    EndTime = endTime,
                    IsActive = true
                };
            if (template.Id == 0)
            {
                _db.ShiftTemplates.Add(template);
                await _db.SaveChangesAsync();
            }

            var cycle = await _db.ShiftCycles.FirstOrDefaultAsync(c =>
                c.GymId == gymId && c.StartDate <= date && c.EndDate >= date);
            if (cycle is null)
            {
                cycle = new ShiftCycle
                {
                    GymId = gymId,
                    StartDate = date,
                    EndDate = date.AddDays(9),
                    Status = ShiftCycleStatus.Published,
                    PublishedAt = DateTime.UtcNow
                };
                _db.ShiftCycles.Add(cycle);
                await _db.SaveChangesAsync();
            }

            _db.ShiftAssignments.Add(new ShiftAssignment
            {
                ShiftCycleId = cycle.Id,
                EmployeeId = employeeId,
                Date = date,
                ShiftTemplateId = template.Id
            });
            await _db.SaveChangesAsync();
        }

        private async Task<string> CreateUniqueStationCodeAsync(int gymId)
        {
            for (var attempt = 0; attempt < 20; attempt++)
            {
                var candidate = _random.Next(0, 1_000_000).ToString("D6");
                if (!await _db.StationCodes.AnyAsync(sc => sc.Code == candidate))
                {
                    _db.StationCodes.Add(new StationCode
                    {
                        GymId = gymId,
                        Code = candidate,
                        IsActive = true,
                        GeneratedAt = DateTime.UtcNow
                    });
                    await _db.SaveChangesAsync();
                    return candidate;
                }
            }

            throw new InvalidOperationException("Could not generate a unique station code for the test.");
        }

        private static string UniqueSuffix() =>
            Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

        // Reuses the seeded dev password so login helpers keep working for test users.
        private static string DevelopmentDataSeederEmployeePassword =>
            ReviveHRSystem.Web.DataSeed.DevelopmentDataSeeder.EmployeePassword;
    }
}
