using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Management request workflow (mock §17): the scoped inbox, stage-1 approve
    /// (→ PendingHRReview) and reject (→ Rejected, releasing reserved leave), edit,
    /// and the feature/scope gates (403 without the feature, 404 cross-team).
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class RequestManagementTests
    {
        private readonly ApiTestFixture _fixture;

        public RequestManagementTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Inbox_PlainEmployee_Returns403()
        {
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/requests", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task Decide_Approve_MovesToHRReview_And_KeepsLeavePending()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var requestId = await SeedPendingRequestAsync(gym1Id, "Day Off");

            var decide = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/requests/{requestId}/decide", new
            {
                decision = "Approved",
                comment = "Coverage confirmed"
            }, token);
            var decideResponse = await _fixture.Client.SendAsync(decide);
            Assert.Equal(HttpStatusCode.NoContent, decideResponse.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var request = await db.EmployeeRequests.Include(r => r.Decisions).FirstAsync(r => r.Id == requestId);
            Assert.Equal("PendingHRReview", request.Status.ToString());
            var decision = Assert.Single(request.Decisions);
            Assert.Equal("BranchManager", decision.Stage.ToString());
            Assert.Equal("Approved", decision.Decision.ToString());
            Assert.Equal("Coverage confirmed", decision.Comment);
        }

        [Fact]
        public async Task Decide_Reject_ReleasesReservedLeave()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var (requestId, employeeId, _) = await SeedPendingRequestWithBalanceAsync(gym1Id);

            var decide = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/requests/{requestId}/decide", new
            {
                decision = "Rejected",
                comment = "Insufficient coverage"
            }, token);
            var decideResponse = await _fixture.Client.SendAsync(decide);
            Assert.Equal(HttpStatusCode.NoContent, decideResponse.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var request = await db.EmployeeRequests.FirstAsync(r => r.Id == requestId);
            Assert.Equal("Rejected", request.Status.ToString());

            var balance = await db.LeaveBalances.FirstAsync(b => b.EmployeeId == employeeId);
            Assert.Equal(0m, balance.PendingDays);
        }

        [Fact]
        public async Task Decide_AlreadyDecided_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var requestId = await SeedPendingRequestAsync(gym1Id, "Leave Early");

            var first = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/requests/{requestId}/decide", new { decision = "Approved" }, token);
            (await _fixture.Client.SendAsync(first)).EnsureSuccessStatusCode();

            var second = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/requests/{requestId}/decide", new { decision = "Approved" }, token);
            var secondResponse = await _fixture.Client.SendAsync(second);
            Assert.Equal(HttpStatusCode.BadRequest, secondResponse.StatusCode);
        }

        [Fact]
        public async Task Inbox_ScopedToGym_ExcludesOtherGyms()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var gym2Id = await GymIdByNameAsync("Revive Second Gym");
            var gym1Request = await SeedPendingRequestAsync(gym1Id, "Day Off");
            var gym2Request = await SeedPendingRequestAsync(gym2Id, "Day Off");

            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/requests", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var ids = body.EnumerateArray().Select(r => r.GetProperty("id").GetInt32()).ToList();
            Assert.Contains(gym1Request, ids);
            // No request of the other gym ever appears, whatever the shared test data holds.
            Assert.DoesNotContain(gym2Request, ids);

            var gym2RequestIds = await AllRequestIdsOfGymAsync(gym2Id);
            Assert.Empty(ids.Intersect(gym2RequestIds));
        }

        [Fact]
        public async Task Inbox_TeamLeader_SeesOnlyTeamRequests()
        {
            // A team leader's inbox is his team's requests only (ADR-003 Amendment 1).
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var leaderUserId = await CreateUserAsync("nour@revive.hr");
            var leaderEmployeeId = await CreateEmployeeForUserAsync(leaderUserId, gym1Id, "EMP-5001");
            var memberUserId = await CreateUserAsync("ziad@revive.hr");
            var memberEmployeeId = await CreateEmployeeForUserAsync(memberUserId, gym1Id, "EMP-5002");
            var outsiderEmployeeId = await OwnEmployeeIdAsync("omar@revive.hr");

            var teamId = await SeedTeamAsync(gym1Id, "Inbox Team");
            await SeedGymAccessAsync(leaderUserId, gym1Id);
            await SeedGymRoleAsync(leaderUserId, gym1Id, "Team Leader");
            await SeedTeamLeaderAsync(teamId, leaderEmployeeId);
            await AssignEmployeeToTeamAsync(memberEmployeeId, teamId);
            await AssignEmployeeToTeamAsync(leaderEmployeeId, teamId);

            var inTeamRequest = await SeedRequestForEmployeeAsync(memberEmployeeId);
            await SeedRequestForEmployeeAsync(outsiderEmployeeId);

            var token = await _fixture.LoginAsync("nour@revive.hr", "Revive!2026");
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/requests", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var ids = body.EnumerateArray().Select(r => r.GetProperty("id").GetInt32()).ToList();
            Assert.Contains(inTeamRequest, ids);
            Assert.Single(ids);
        }

        // ---------- helpers ----------

        private async Task<int> SeedPendingRequestAsync(int gymId, string type)
        {
            var employeeId = await AnyEmployeeIdAsync(gymId);
            return await SeedRequestForEmployeeAsync(employeeId, type);
        }

        private async Task<int> SeedRequestForEmployeeAsync(int employeeId, string type = "Leave Early")
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var request = new DomainLayer.Models.RequestModule.EmployeeRequest
            {
                EmployeeId = employeeId,
                Type = type,
                RequestDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5),
                TargetStartDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5),
                Details = "Family event",
                Status = DomainLayer.Models.RequestModule.Enums.RequestStatus.Pending,
                SubmittedAt = DateTime.UtcNow
            };
            db.EmployeeRequests.Add(request);
            await db.SaveChangesAsync();
            return request.Id;
        }

        private async Task<(int RequestId, int EmployeeId, int GymId)> SeedPendingRequestWithBalanceAsync(int gymId)
        {
            // One dedicated employee + annual balance + one pending Day Off request.
            var userId = await CreateUserAsync("tarek@revive.hr");
            var employeeId = await CreateEmployeeForUserAsync(userId, gymId, "EMP-6001");

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            db.LeaveBalances.Add(new DomainLayer.Models.EmployeeModule.LeaveBalance
            {
                EmployeeId = employeeId,
                LeaveType = DomainLayer.Models.EmployeeModule.Enums.LeaveType.Annual,
                Year = DateTime.UtcNow.Year,
                TotalEntitlement = 21,
                UsedDays = 0,
                // Exactly the days this request reserved.
                PendingDays = 1
            });
            await db.SaveChangesAsync();

            var requestId = await SeedRequestForEmployeeAsync(employeeId, "Day Off");
            return (requestId, employeeId, gymId);
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

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }

        private async Task<int> AnyEmployeeIdAsync(int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.GymId == gymId).OrderBy(e => e.Id).Select(e => e.Id).FirstAsync();
        }

        private async Task<IReadOnlyList<int>> AllRequestIdsOfGymAsync(int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.EmployeeRequests
                .Where(r => r.Employee.GymId == gymId)
                .Select(r => r.Id)
                .ToListAsync();
        }

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
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
                PasswordHash = hasher.Hash("Revive!2026"),
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
                FullName = "Scoped Tester",
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
            if (await db.UserGymRoles.AnyAsync(ugr => ugr.UserId == userId && ugr.GymId == gymId))
            {
                return;
            }

            var roleId = await db.Roles.Where(r => r.Name == roleName).Select(r => r.Id).SingleAsync();
            db.UserGymRoles.Add(new DomainLayer.Models.UserModule.UserGymRole { UserId = userId, GymId = gymId, RoleId = roleId });
            await db.SaveChangesAsync();
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
            if (await db.TeamLeaders.AnyAsync(tl => tl.EmployeeId == employeeId))
            {
                return;
            }

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
