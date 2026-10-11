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
    /// Employee management (mock §21) and the [HasFeatureAccess] machinery:
    /// View reads / Edit writes, team scope for Team Leaders, gym scope for Branch
    /// Managers, 403 without the feature, 404 cross-scope, and status changes recorded
    /// on the employment-history timeline.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class EmployeeManagementTests
    {
        private readonly ApiTestFixture _fixture;

        public EmployeeManagementTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Directory_PlainEmployee_Returns403()
        {
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task Directory_BranchManager_SeesGymRoster()
        {
            var token = await LoginSelectingGymAsync("omar@revive.hr", await GymIdByNameAsync("Revive Main Gym"));

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(body.EnumerateArray(), e => e.GetProperty("name").GetString() == "Karim Hassan");
        }

        [Fact]
        public async Task Directory_CrossGym_SeesOnlyActiveGym()
        {
            var gym1Token = await LoginSelectingGymAsync("omar@revive.hr", await GymIdByNameAsync("Revive Main Gym"));
            var gym2Token = await LoginSelectingGymAsync("omar@revive.hr", await GymIdByNameAsync("Revive Second Gym"));

            var gym1Employees = await GetNamesAsync(gym1Token);
            var gym2Employees = await GetNamesAsync(gym2Token);

            // Gym isolation: neither roster contains the other gym's employees.
            Assert.Contains("Karim Hassan", gym1Employees);
            Assert.Contains("Sara Ali", gym2Employees);
            Assert.DoesNotContain("Sara Ali", gym1Employees);
            Assert.DoesNotContain("Karim Hassan", gym2Employees);
        }

        [Fact]
        public async Task Create_Edit_StatusChange_RecordsHistory()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var positionId = await AnyPositionIdAsync(gym1Id);

            var create = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/employees", new
            {
                fullName = "Nadia Fouad",
                positionId
            }, token);
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            var employeeId = created.GetProperty("id").GetInt32();
            Assert.Equal("NF", created.GetProperty("initials").GetString());

            var edit = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/employees/{employeeId}", new
            {
                fullName = "Nadia Fouad Ahmed",
                positionId,
                status = "Active"
            }, token);
            var editResponse = await _fixture.Client.SendAsync(edit);
            editResponse.EnsureSuccessStatusCode();
            var edited = await editResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Nadia Fouad Ahmed", edited.GetProperty("name").GetString());

            var statusChange = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{employeeId}/status-change", new
            {
                status = "Suspended",
                note = "Pending investigation"
            }, token);
            var statusResponse = await _fixture.Client.SendAsync(statusChange);
            Assert.Equal(HttpStatusCode.NoContent, statusResponse.StatusCode);

            // The status change is a timeline event, not an overwrite.
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var history = await db.EmploymentHistories
                .Where(h => h.EmployeeId == employeeId && h.ChangeType == DomainLayer.Models.EmployeeModule.Enums.EmploymentChangeType.StatusChange)
                .ToListAsync();
            var entry = Assert.Single(history);
            Assert.Contains("Active", entry.OldValueJson!);
            Assert.Contains("Suspended", entry.NewValueJson!);
            Assert.Equal("Pending investigation", entry.Reason);
        }

        [Fact]
        public async Task Update_CrossGymEmployee_AsBranchManager_Returns404()
        {
            // Sara works at gym2; Omar's management scope is gym1.
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");
            var token = await LoginSelectingGymAsync("omar@revive.hr", await GymIdByNameAsync("Revive Main Gym"));
            var positionId = await AnyPositionIdAsync(await GymIdByNameAsync("Revive Main Gym"));

            var request = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/employees/{saraId}", new
            {
                fullName = "Sara Ali",
                positionId,
                status = "Active"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Directory_WithoutGymScopedToken_Returns403()
        {
            // HR/Super Admin tokens without a chosen gym have no feature levels.
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task Directory_TeamLeader_SeesTeamOnly()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var leaderUserId = await CreateUserAsync("layla@revive.hr");
            var leaderEmployeeId = await CreateEmployeeForUserAsync(leaderUserId, gym1Id, "EMP-3001");
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");

            var teamId = await SeedTeamAsync(gym1Id, "Leadership Team");
            await SeedGymAccessAsync(leaderUserId, gym1Id);
            await SeedGymRoleAsync(leaderUserId, gym1Id, "Team Leader");
            await SeedTeamLeaderAsync(teamId, leaderEmployeeId);
            await AssignEmployeeToTeamAsync(karimId, teamId);
            await AssignEmployeeToTeamAsync(leaderEmployeeId, teamId);

            var token = await _fixture.LoginAsync("layla@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var names = body.EnumerateArray().Select(e => e.GetProperty("name").GetString()).ToList();
            Assert.Contains("Karim Hassan", names!);
            // Sara works at another gym and is not in the team.
            Assert.DoesNotContain("Sara Ali", names!);
            Assert.Equal(2, names.Count);
        }

        // ---------- helpers ----------

        private async Task<IReadOnlyList<string>> GetNamesAsync(string token)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees", null, token);
            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return body.EnumerateArray().Select(e => e.GetProperty("name").GetString()!).ToList();
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

        private async Task<int> AnyPositionIdAsync(int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Positions.Where(p => p.GymId == gymId).OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();
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

        private async Task<int> SeedTeamAsync(int gymId, string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var team = new DomainLayer.Models.OrganizationModule.Team { GymId = gymId, Name = name };
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team.Id;
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
    }
}
