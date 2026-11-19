using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Shared.Authorization;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Regression suite for the four systemic root causes (audit §1.1–§1.4):
    /// the gym-scope contract, per-gym role storage, team-scope resolution, and
    /// soft delete colliding with unique indexes.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class SystemicAccessTests
    {
        private readonly ApiTestFixture _fixture;
        private readonly TestDataBuilder _builder;

        public SystemicAccessTests(ApiTestFixture fixture)
        {
            _fixture = fixture;
            _builder = new TestDataBuilder(fixture.Services);
        }

        // ------------------------------------------------------------------
        // §1.1 — a user with no active gym must not reach org-wide scope
        // ------------------------------------------------------------------

        [Fact]
        public async Task NonTopManagementUser_WithNoActiveGym_CannotSignIn()
        {
            var user = await _builder.CreateUserAsync(UserType.HR, Array.Empty<TestGym>());

            var response = await _fixture.Client.PostAsJsonAsync(
                "/api/auth/login", new { email = user.Email, password = user.Password });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task HrUser_WhoseOnlyGymIsDeactivated_CannotSignIn()
        {
            var gym = await _builder.CreateGymWithStationAsync();
            var user = await _builder.CreateUserAsync(UserType.HR, new[] { gym });

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var row = await db.Gyms.SingleAsync(g => g.Id == gym.GymId);
                row.Status = GymStatus.Inactive;
                await db.SaveChangesAsync();
            }

            var response = await _fixture.Client.PostAsJsonAsync(
                "/api/auth/login", new { email = user.Email, password = user.Password });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task TopManagement_SeesEmployeesOfGymsCreatedAfterSeeding()
        {
            var gym = await _builder.CreateGymWithStationAsync();
            var employee = await _builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            var response = await SendAsync(HttpMethod.Get, $"/api/employees?page=1&pageSize=100&search={Uri.EscapeDataString(employee.FullName)}", token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items").EnumerateArray().ToList();
            Assert.Contains(items, i =>
                i.TryGetProperty("employeeNumber", out var number) &&
                number.GetString() == employee.EmployeeNumber);
        }

        // ------------------------------------------------------------------
        // §1.2 — UserGymRoles is the authoritative per-gym store
        // ------------------------------------------------------------------

        [Fact]
        public async Task CreatedHrAccount_GetsPerGymRoleRow()
        {
            var gym = await _builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var email = $"new-hr-{Guid.NewGuid():N}@test.local";

            var response = await SendAsync(HttpMethod.Post, "/api/users", token, new
            {
                fullName = "New HR",
                email,
                gymIds = new[] { gym.GymId },
                rolePreset = RoleNames.Hr,
            });

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var userId = body.GetProperty("data").GetProperty("id").GetInt32();

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var roleNames = await (
                from ugr in db.UserGymRoles
                where ugr.UserId == userId && ugr.GymId == gym.GymId
                select ugr.Role.Name
            ).ToListAsync();

            Assert.Contains(RoleNames.Hr, roleNames);
        }

        [Fact]
        public async Task RoleChange_WritesPerGymRole_AndLeavesOtherGymRoleUntouched()
        {
            var gymA = await _builder.CreateGymWithStationAsync();
            var gymB = await _builder.CreateGymWithStationAsync();
            var employee = await _builder.CreateEmployeeAsync(gymA, new[] { gymA, gymB });
            var token = await _fixture.GetAdminTokenAsync();

            await AssignGymRoleAsync(employee.UserId, gymB.GymId, RoleNames.TeamLeader);

            var roleName = $"Probe Role {Guid.NewGuid():N}";
            await CreateRoleAsync(token, roleName);

            var response = await SendAsync(
                HttpMethod.Post, $"/api/employees/{employee.EmployeeId}/role-change", token,
                new { systemRole = roleName });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var gymARoles = await (
                from ugr in db.UserGymRoles
                where ugr.UserId == employee.UserId && ugr.GymId == gymA.GymId
                select ugr.Role.Name
            ).ToListAsync();
            var gymBRoles = await (
                from ugr in db.UserGymRoles
                where ugr.UserId == employee.UserId && ugr.GymId == gymB.GymId
                select ugr.Role.Name
            ).ToListAsync();

            Assert.Contains(roleName, gymARoles);
            Assert.Contains(RoleNames.TeamLeader, gymBRoles);
        }

        [Fact]
        public async Task PromotedEmployee_ExposesSystemRoleInEmployeeDetail()
        {
            var gym = await _builder.CreateGymWithStationAsync();
            var employee = await _builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            var roleName = $"Promoted Role {Guid.NewGuid():N}";
            await CreateRoleAsync(token, roleName);

            var change = await SendAsync(
                HttpMethod.Post, $"/api/employees/{employee.EmployeeId}/role-change", token,
                new { systemRole = roleName });
            Assert.Equal(HttpStatusCode.OK, change.StatusCode);

            var detail = await SendAsync(HttpMethod.Get, $"/api/employees/{employee.EmployeeId}", token);
            Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(roleName, body.GetProperty("data").GetProperty("systemRole").GetString());
        }

        // ------------------------------------------------------------------
        // §1.3 — team scope fails closed and supports several teams
        // ------------------------------------------------------------------

        [Fact]
        public async Task TeamLeaderWithoutTeam_IsDeniedAnotherEmployee()
        {
            var gym = await _builder.CreateGymWithStationAsync();
            var leader = await _builder.CreateEmployeeAsync(gym);
            var other = await _builder.CreateEmployeeAsync(gym);
            await _builder.GrantPermissionAsync(leader.UserId, "employees.view");
            await AssignGymRoleAsync(leader.UserId, gym.GymId, RoleNames.TeamLeader);

            var token = await _fixture.LoginAsync(leader.Email, leader.Password);
            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{other.EmployeeId}", token);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task TeamLeader_SeesOwnTeamOnly()
        {
            var gym = await _builder.CreateGymWithStationAsync();
            var leader = await _builder.CreateEmployeeAsync(gym);
            var member = await _builder.CreateEmployeeAsync(gym);
            var outsider = await _builder.CreateEmployeeAsync(gym);
            await _builder.GrantPermissionAsync(leader.UserId, "employees.view");
            await AssignGymRoleAsync(leader.UserId, gym.GymId, RoleNames.TeamLeader);

            var ownTeam = await SeedTeamAsync(gym.GymId, $"Team A {Guid.NewGuid():N}");
            var otherTeam = await SeedTeamAsync(gym.GymId, $"Team B {Guid.NewGuid():N}");
            await SeedTeamLeaderAsync(leader.EmployeeId, ownTeam);
            await AssignEmployeeToTeamAsync(member.EmployeeId, ownTeam);
            await AssignEmployeeToTeamAsync(outsider.EmployeeId, otherTeam);

            var token = await _fixture.LoginAsync(leader.Email, leader.Password);
            var response = await SendAsync(HttpMethod.Get, "/api/employees?page=1&pageSize=100", token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var numbers = body.GetProperty("items").EnumerateArray()
                .Where(i => i.TryGetProperty("employeeNumber", out _))
                .Select(i => i.GetProperty("employeeNumber").GetString())
                .ToList();

            Assert.Contains(member.EmployeeNumber, numbers);
            Assert.DoesNotContain(outsider.EmployeeNumber, numbers);
        }

        [Fact]
        public async Task RevokingGymAccess_DeniesTheGymAndKeepsTheRoleForReGrant()
        {
            var gymA = await _builder.CreateGymWithStationAsync();
            var gymB = await _builder.CreateGymWithStationAsync();
            var user = await _builder.CreateUserAsync(UserType.HR, new[] { gymA, gymB });
            await AssignGymRoleAsync(user.UserId, gymA.GymId, RoleNames.Hr);
            await AssignGymRoleAsync(user.UserId, gymB.GymId, RoleNames.Hr);
            var token = await _fixture.GetAdminTokenAsync();

            var response = await SendAsync(
                HttpMethod.Put, $"/api/users/{user.UserId}/gym-access", token,
                new { gymIds = new[] { gymA.GymId } });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();

            // Access is gone ...
            Assert.False(await db.UserGymAccesses.AnyAsync(a => a.UserId == user.UserId && a.GymId == gymB.GymId));
            // ... but the role row survives, so re-granting the gym restores the account.
            Assert.True(await db.UserGymRoles.AnyAsync(ugr => ugr.UserId == user.UserId && ugr.GymId == gymB.GymId));
        }

        [Fact]
        public async Task GrantingGymAccess_InheritsTheAccountsRole()
        {
            var gymA = await _builder.CreateGymWithStationAsync();
            var gymB = await _builder.CreateGymWithStationAsync();
            var user = await _builder.CreateUserAsync(UserType.HR, new[] { gymA });
            await AssignGymRoleAsync(user.UserId, gymA.GymId, RoleNames.Hr);
            var token = await _fixture.GetAdminTokenAsync();

            var response = await SendAsync(
                HttpMethod.Put, $"/api/users/{user.UserId}/gym-access", token,
                new { gymIds = new[] { gymA.GymId, gymB.GymId } });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var newGymRoles = await (
                from ugr in db.UserGymRoles
                where ugr.UserId == user.UserId && ugr.GymId == gymB.GymId
                select ugr.Role.Name
            ).ToListAsync();

            Assert.Contains(RoleNames.Hr, newGymRoles);
        }

        // ------------------------------------------------------------------
        // §1.4 — soft-deleted rows must not occupy unique slots
        // ------------------------------------------------------------------

        [Fact]
        public async Task ArchivedRoleName_CanBeReused()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var name = $"Reusable Role {Guid.NewGuid():N}";
            var created = await CreateRoleAsync(token, name);
            var roleId = created.GetProperty("id").GetInt32();

            var archive = await SendAsync(HttpMethod.Delete, $"/api/roles/{roleId}", token);
            Assert.Equal(HttpStatusCode.NoContent, archive.StatusCode);

            var recreate = await SendAsync(HttpMethod.Post, "/api/roles", token, new { name });
            Assert.Equal(HttpStatusCode.Created, recreate.StatusCode);
        }

        [Fact]
        public async Task SoftDeletedUserEmail_CanBeReused()
        {
            var gym = await _builder.CreateGymWithStationAsync();
            var user = await _builder.CreateUserAsync(UserType.HR, new[] { gym });

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var row = await db.Users.SingleAsync(u => u.Id == user.UserId);
                db.Entry(row).Property("IsDeleted").CurrentValue = true;
                await db.SaveChangesAsync();
            }

            var token = await _fixture.GetAdminTokenAsync();
            var response = await SendAsync(HttpMethod.Post, "/api/users", token, new
            {
                fullName = "Reused Email",
                email = user.Email,
                gymIds = new[] { gym.GymId },
            });

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private async Task<HttpResponseMessage> SendAsync(
            HttpMethod method, string url, string token, object? body = null)
        {
            var request = _fixture.AuthorizedRequest(method, url, body, token);
            return await _fixture.Client.SendAsync(request);
        }

        private async Task<JsonElement> CreateRoleAsync(string token, string name)
        {
            var response = await SendAsync(HttpMethod.Post, "/api/roles", token, new { name });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return body.GetProperty("data");
        }

        private async Task AssignGymRoleAsync(int userId, int gymId, string roleName)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var roleId = await db.Roles.Where(r => r.Name == roleName).Select(r => r.Id).SingleAsync();
            db.UserGymRoles.Add(new UserGymRole { UserId = userId, GymId = gymId, RoleId = roleId });
            await db.SaveChangesAsync();
        }

        private async Task<int> SeedTeamAsync(int gymId, string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var team = new Team { GymId = gymId, Name = name };
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team.Id;
        }

        private async Task SeedTeamLeaderAsync(int employeeId, int teamId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            db.TeamLeaders.Add(new TeamLeader { TeamId = teamId, EmployeeId = employeeId });
            await db.SaveChangesAsync();
        }

        private async Task AssignEmployeeToTeamAsync(int employeeId, int teamId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var employee = await db.Employees.SingleAsync(e => e.Id == employeeId);
            employee.TeamId = teamId;
            await db.SaveChangesAsync();
        }
    }
}
