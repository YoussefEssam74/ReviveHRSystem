using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.Web.DataSeed;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Evaluations, employment history, events feed, payroll and the dashboard
    /// aggregate (mock §§1, 4, 5, 8, 9). Each test seeds its own data; cross-scope
    /// reads answer 404 and gym-scoped feeds never leak other gyms' items.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class EvaluationsHistoryPayrollDashboardTests
    {
        private readonly ApiTestFixture _fixture;

        public EvaluationsHistoryPayrollDashboardTests(ApiTestFixture fixture) => _fixture = fixture;


        [Fact]
        public async Task Dashboard_PlainEmployee_HasNoOverviewStrip()
        {
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/dashboard/employee", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Karim", body.GetProperty("user").GetProperty("firstName").GetString());
            Assert.Equal("Fitness Trainer", body.GetProperty("user").GetProperty("position").GetString());
            Assert.Equal(JsonValueKind.Null, body.GetProperty("overview").ValueKind);
        }

        [Fact]
        public async Task Dashboard_BranchManager_HasGymScopedOverview()
        {
            var token = await LoginSelectingGymAsync("omar@revive.hr", await GymIdByNameAsync("Revive Main Gym"));

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/dashboard/employee", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var overview = body.GetProperty("overview");
            Assert.Equal("branch", overview.GetProperty("scope").GetString());
            Assert.True(overview.GetProperty("memberCount").GetInt32() >= 1);
        }

        [Fact]
        public async Task Dashboard_TeamLeader_HasTeamScopedOverview()
        {
            // Employee.TeamId is FK-anchored to the employee's PRIMARY gym (teams cannot
            // span gyms), and an employee leads exactly one team (unique index), so the
            // team-leader scope applies in that gym: dedicated users keep this test
            // isolated from the other suites that build teams.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var leaderUserId = await CreateUserAsync("michael@revive.hr");
            var leaderEmployeeId = await CreateEmployeeForUserAsync(leaderUserId, gym1Id, "EMP-4001");
            var memberUserId = await CreateUserAsync("dina@revive.hr");
            var memberEmployeeId = await CreateEmployeeForUserAsync(memberUserId, gym1Id, "EMP-4002");

            var teamId = await SeedTeamAsync(gym1Id, "Morning Floor Team");
            await SeedGymAccessAsync(leaderUserId, gym1Id);
            await SeedGymRoleAsync(leaderUserId, gym1Id, "Team Leader");
            await SeedTeamLeaderAsync(teamId, leaderEmployeeId);
            await AssignEmployeeToTeamAsync(memberEmployeeId, teamId);
            await AssignEmployeeToTeamAsync(leaderEmployeeId, teamId);

            var token = await _fixture.LoginAsync("michael@revive.hr", DevelopmentDataSeeder.EmployeePassword);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/dashboard/employee", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var overview = body.GetProperty("overview");
            Assert.Equal("team", overview.GetProperty("scope").GetString());
            // Team scope: leader + one member, never the whole gym roster.
            Assert.Equal(2, overview.GetProperty("memberCount").GetInt32());
        }

        // ---------- seeding helpers ----------

        private async Task<int> SeedTeamAsync(int gymId, string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var team = new DomainLayer.Models.OrganizationModule.Team { GymId = gymId, Name = name };
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team.Id;
        }

        private async Task<int> CreateUserAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (existing is not null)
            {
                return existing.Id;
            }

            var hasher = scope.ServiceProvider.GetRequiredService<ServiceAbstraction.Services.IPasswordHasher>();
            var user = new DomainLayer.Models.UserModule.User
            {
                Email = email,
                UserName = email.Split('@')[0],
                PasswordHash = hasher.Hash(DevelopmentDataSeeder.EmployeePassword),
                UserType = DomainLayer.Models.UserModule.Enums.UserType.Employee,
                IsActive = true
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return user.Id;
        }

        private async Task<int> CreateEmployeeForUserAsync(int userId, int gymId, string employeeNumber)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var existing = await db.Employees.FirstOrDefaultAsync(e => e.UserId == userId);
            if (existing is not null)
            {
                return existing.Id;
            }

            var positionId = await db.Positions.Where(p => p.GymId == gymId).OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();
            var employee = new DomainLayer.Models.EmployeeModule.Employee
            {
                UserId = userId,
                GymId = gymId,
                PositionId = positionId,
                FullName = "Layla Mostafa",
                EmployeeNumber = employeeNumber,
                HireDate = new DateOnly(2026, 1, 5),
                ContractType = "FullTime",
                ContractStartDate = new DateOnly(2026, 1, 5),
                Status = DomainLayer.Models.EmployeeModule.Enums.EmployeeStatus.Active
            };
            db.Employees.Add(employee);
            await db.SaveChangesAsync();
            return employee.Id;
        }

        private async Task SeedGymAccessAsync(int userId, int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            if (!await db.UserGymAccesses.AnyAsync(a => a.UserId == userId && a.GymId == gymId))
            {
                db.UserGymAccesses.Add(new DomainLayer.Models.UserModule.UserGymAccess { UserId = userId, GymId = gymId });
                await db.SaveChangesAsync();
            }
        }

        private async Task SeedGymRoleAsync(int userId, int gymId, string roleName)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var roleId = await db.Roles.Where(r => r.Name == roleName).Select(r => r.Id).SingleAsync();
            if (!await db.UserGymRoles.AnyAsync(ugr => ugr.UserId == userId && ugr.GymId == gymId))
            {
                db.UserGymRoles.Add(new DomainLayer.Models.UserModule.UserGymRole { UserId = userId, GymId = gymId, RoleId = roleId });
                await db.SaveChangesAsync();
            }
        }


        private async Task SeedTeamLeaderAsync(int teamId, int employeeId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            db.TeamLeaders.Add(new DomainLayer.Models.OrganizationModule.TeamLeader { TeamId = teamId, EmployeeId = employeeId });
            await db.SaveChangesAsync();
        }

        private async Task AssignEmployeeToTeamAsync(int employeeId, int teamId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var employee = await db.Employees.FindAsync(employeeId);
            employee!.TeamId = teamId;
            await db.SaveChangesAsync();
        }

        private async Task<string> LoginSelectingGymAsync(string email, int gymId)
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new { email, password = "Revive!2026" });
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            var temp = loginBody.GetProperty("tempSessionToken").GetString()!;

            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new { gymId, tempSessionToken = temp });
            select.EnsureSuccessStatusCode();
            var selectBody = await select.Content.ReadFromJsonAsync<JsonElement>();
            return selectBody.GetProperty("accessToken").GetString()!;
        }

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }
    }
}
