using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Effective permission resolution and team-scope resolution (ADR-003 Amendment 1):
    /// wildcard > per-gym individual grant > per-gym role bundle > global grant > None.
    /// Scope comes from the per-gym role (Team Leader = team-scoped).
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class PermissionResolutionTests
    {
        private readonly ApiTestFixture _fixture;

        public PermissionResolutionTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task GymGrant_Overrides_RoleBundle()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var userId = await CreateUserAsync("grant-override@test.local");

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                await db.UserGymAccesses.AddAsync(new UserGymAccess { UserId = userId, GymId = gymId });
                await db.UserGymRoles.AddAsync(new UserGymRole { UserId = userId, GymId = gymId, RoleId = await RoleIdAsync(db, RoleNames.BranchManager) });

                var employees = await db.Permissions.SingleAsync(p => p.Key == Features.Employees);
                // Individual per-gym grant DOWNGRADES the role bundle's Edit to View.
                await db.UserGymPermissions.AddAsync(new UserGymPermission
                {
                    UserId = userId,
                    GymId = gymId,
                    PermissionId = employees.Id,
                    Level = AccessLevel.View
                });
                await db.SaveChangesAsync();
            }

            var levels = await ResolveLevelsAsync(userId, gymId);

            Assert.Equal(AccessLevel.View, LevelOf(levels, Features.Employees));
            Assert.Equal(AccessLevel.Edit, LevelOf(levels, Features.Attendance)); // untouched bundle entries remain Edit
            Assert.Equal(AccessLevel.None, LevelOf(levels, Features.Payroll));
        }

        [Fact]
        public async Task RoleBundle_IsPerGym_And_DoesNotLeakAcrossGyms()
        {
            var gym1 = await GymIdByNameAsync("Revive Main Gym");
            var gym2 = await GymIdByNameAsync("Revive Second Gym");
            var userId = await CreateUserAsync("gym-isolation@test.local");

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                await db.UserGymAccesses.AddRangeAsync(
                    new UserGymAccess { UserId = userId, GymId = gym1 },
                    new UserGymAccess { UserId = userId, GymId = gym2 });
                await db.UserGymRoles.AddAsync(new UserGymRole
                {
                    UserId = userId,
                    GymId = gym1,
                    RoleId = await RoleIdAsync(db, RoleNames.BranchManager)
                });
                await db.SaveChangesAsync();
            }

            var atGym1 = await ResolveLevelsAsync(userId, gym1);
            var atGym2 = await ResolveLevelsAsync(userId, gym2);

            Assert.Equal(AccessLevel.Edit, LevelOf(atGym1, Features.Employees));
            Assert.Equal(AccessLevel.None, LevelOf(atGym2, Features.Employees));
        }

        [Fact]
        public async Task GlobalGrant_Applies_WhenNoPerGymGrantExists()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var userId = await CreateUserAsync("global-grant@test.local");

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                await db.UserGymAccesses.AddAsync(new UserGymAccess { UserId = userId, GymId = gymId });

                var payroll = await db.Permissions.SingleAsync(p => p.Key == Features.Payroll);
                await db.UserPermissions.AddAsync(new UserPermission { UserId = userId, PermissionId = payroll.Id, Level = AccessLevel.View });
                await db.SaveChangesAsync();
            }

            var levels = await ResolveLevelsAsync(userId, gymId);
            Assert.Equal(AccessLevel.View, LevelOf(levels, Features.Payroll));
            Assert.Equal(AccessLevel.None, LevelOf(levels, Features.Employees));
        }

        [Fact]
        public async Task WildcardGrant_GrantsEverything()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var userId = await CreateUserAsync("wildcard@test.local");

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                await db.UserGymAccesses.AddAsync(new UserGymAccess { UserId = userId, GymId = gymId });

                var wildcard = await db.Permissions.SingleAsync(p => p.Key == Features.Wildcard);
                await db.UserPermissions.AddAsync(new UserPermission { UserId = userId, PermissionId = wildcard.Id, Level = AccessLevel.Edit });
                await db.SaveChangesAsync();
            }

            Assert.True(await HasAccessAsync(userId, gymId, Features.Payroll, AccessLevel.Edit));
            Assert.True(await HasAccessAsync(userId, gymId, Features.Audit, AccessLevel.View));
            Assert.Equal(AccessLevel.Edit, (await ResolveLevelsAsync(userId, gymId))[Features.Wildcard]);
        }

        [Fact]
        public async Task TeamLeaderRole_IsTeamScoped_BranchManagerRole_IsNot()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var userId = await CreateUserAsync("team-scope@test.local");
            var employeeId = await CreateEmployeeForUserAsync(userId, gymId, "EMP-TEAMSCOPE");

            var teamId = 0;
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var team = new Team { GymId = gymId, Name = "Team Scope Unit" };
                await db.Teams.AddAsync(team);
                await db.SaveChangesAsync();
                teamId = team.Id;

                await db.TeamLeaders.AddAsync(new TeamLeader { TeamId = team.Id, EmployeeId = employeeId });
                await db.UserGymAccesses.AddAsync(new UserGymAccess { UserId = userId, GymId = gymId });
                await db.UserGymRoles.AddAsync(new UserGymRole
                {
                    UserId = userId,
                    GymId = gymId,
                    RoleId = await RoleIdAsync(db, RoleNames.TeamLeader)
                });
                await db.SaveChangesAsync();
            }

            Assert.True(await IsTeamScopedAsync(userId, gymId));
            Assert.Equal(teamId, await LedTeamIdAsync(userId, gymId));

            // Switch the per-gym role to Branch Manager: the scope widens to the gym.
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                db.UserGymRoles.RemoveRange(db.UserGymRoles.Where(ugr => ugr.UserId == userId && ugr.GymId == gymId));
                await db.UserGymRoles.AddAsync(new UserGymRole
                {
                    UserId = userId,
                    GymId = gymId,
                    RoleId = await RoleIdAsync(db, RoleNames.BranchManager)
                });
                await db.SaveChangesAsync();
            }

            Assert.False(await IsTeamScopedAsync(userId, gymId));
        }

        private async Task<IReadOnlyDictionary<string, AccessLevel>> ResolveLevelsAsync(int userId, int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IPermissionService>();
            return await service.GetEffectiveLevelsAsync(userId, gymId);
        }

        /// <summary>Effective level of a feature; absent features mean None.</summary>
        private static AccessLevel LevelOf(IReadOnlyDictionary<string, AccessLevel> levels, string feature) =>
            levels.TryGetValue(feature, out var level) ? level : AccessLevel.None;

        private async Task<bool> HasAccessAsync(int userId, int gymId, string feature, AccessLevel level)
        {
            using var scope = _fixture.Services.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IPermissionService>();
            return await service.HasAccessAsync(userId, gymId, feature, level);
        }

        private async Task<bool> IsTeamScopedAsync(int userId, int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<ITeamScopeService>();
            return await service.IsTeamScopedAsync(userId, gymId);
        }

        private async Task<int?> LedTeamIdAsync(int userId, int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<ITeamScopeService>();
            return await service.GetLedTeamIdAsync(userId, gymId);
        }

        private static async Task<int> RoleIdAsync(ReviveHrDbContext db, string roleName) =>
            await db.Roles.Where(r => r.Name == roleName).Select(r => r.Id).SingleAsync();

        private async Task<int> CreateUserAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var user = new User
            {
                Email = email,
                UserName = email.Split('@')[0],
                PasswordHash = "not-a-real-hash",
                UserType = UserType.Employee,
                IsActive = true
            };
            await db.Users.AddAsync(user);
            await db.SaveChangesAsync();
            return user.Id;
        }

        private async Task<int> CreateEmployeeForUserAsync(int userId, int gymId, string employeeNumber)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var positionId = await db.Positions.OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();
            var employee = new Employee
            {
                UserId = userId,
                GymId = gymId,
                PositionId = positionId,
                FullName = "Scope Tester",
                EmployeeNumber = employeeNumber,
                HireDate = new DateOnly(2026, 1, 5),
                ContractType = "FullTime",
                ContractStartDate = new DateOnly(2026, 1, 5),
                Status = EmployeeStatus.Active
            };
            await db.Employees.AddAsync(employee);
            await db.SaveChangesAsync();
            return employee.Id;
        }

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }
    }
}
