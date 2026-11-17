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
        public async Task Comment_Post_OnInScopeRequest_Succeeds()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var requestId = await SeedPendingRequestAsync(gym1Id, "Annual Leave");

            var comment = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/requests/{requestId}/comments", new
            {
                comment = "I will cover the morning shift."
            }, token);
            var response = await _fixture.Client.SendAsync(comment);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("I will cover the morning shift.", body.GetProperty("body").GetString());

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            Assert.True(await db.RequestComments.AnyAsync(c => c.RequestId == requestId));
        }

        [Fact]
        public async Task Comment_EmptyBody_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var requestId = await SeedPendingRequestAsync(gym1Id, "Annual Leave");

            var comment = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/requests/{requestId}/comments", new
            {
                comment = "   "
            }, token);
            var response = await _fixture.Client.SendAsync(comment);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Comment_OversizedBody_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var requestId = await SeedPendingRequestAsync(gym1Id, "Annual Leave");

            var comment = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/requests/{requestId}/comments", new
            {
                comment = new string('x', 1001)
            }, token);
            var response = await _fixture.Client.SendAsync(comment);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Comment_OtherGymsRequest_Returns404()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var gym2Id = await GymIdByNameAsync("Revive Second Gym");
            var outsiderRequestId = await SeedPendingRequestAsync(gym2Id, "Annual Leave");

            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var comment = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/requests/{outsiderRequestId}/comments", new
            {
                comment = "Should never land."
            }, token);
            var response = await _fixture.Client.SendAsync(comment);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

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

            var requestId = await SeedRequestForEmployeeAsync(employeeId, "Annual Leave");
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
