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
    /// Management surface part 3 (mock §§13, 24): team overview and offboarding —
    /// feature-gated, team-scoped for Team Leaders and gym-scoped for Branch Managers.
    /// The attendance day view and vacancy requests are covered by the HR-portal
    /// suites (AttendanceManagementControllerTests / RecruitmentControllerTests).
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class AttendanceTeamRecruitmentOffboardingTests
    {
        private readonly ApiTestFixture _fixture;

        public AttendanceTeamRecruitmentOffboardingTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Teams_TeamLeader_SeesOwnTeamOnly()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var leaderUserId = await CreateUserAsync("hasan@revive.hr");
            var leaderEmployeeId = await CreateEmployeeForUserAsync(leaderUserId, gym1Id, "EMP-7101");
            var teamId = await SeedTeamAsync(gym1Id, "Hasans Team");

            await SeedGymAccessAsync(leaderUserId, gym1Id);
            await SeedGymRoleAsync(leaderUserId, gym1Id, "Team Leader");
            await SeedTeamLeaderAsync(teamId, leaderEmployeeId);
            await AssignEmployeeToTeamAsync(leaderEmployeeId, teamId);

            var token = await _fixture.LoginAsync("hasan@revive.hr", "Revive!2026");

            var listRequest = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/teams/my-teams", null, token);
            var listResponse = await _fixture.Client.SendAsync(listRequest);
            listResponse.EnsureSuccessStatusCode();
            var teams = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(teams.EnumerateArray(), t => t.GetProperty("id").GetInt32() == teamId);

            var todayRequest = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/teams/{teamId}/today", null, token);
            var todayResponse = await _fixture.Client.SendAsync(todayRequest);
            todayResponse.EnsureSuccessStatusCode();
            var team = await todayResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Hasans Team", team.GetProperty("teamName").GetString());
        }

        [Fact]
        public async Task Teams_ForeignTeam_Returns404()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var leaderUserId = await CreateUserAsync("waleed@revive.hr");
            var leaderEmployeeId = await CreateEmployeeForUserAsync(leaderUserId, gym1Id, "EMP-7102");
            var myTeam = await SeedTeamAsync(gym1Id, "Waleeds Team");
            var foreignTeam = await SeedTeamAsync(gym1Id, "Foreign Team");

            await SeedGymAccessAsync(leaderUserId, gym1Id);
            await SeedGymRoleAsync(leaderUserId, gym1Id, "Team Leader");
            await SeedTeamLeaderAsync(myTeam, leaderEmployeeId);
            await AssignEmployeeToTeamAsync(leaderEmployeeId, myTeam);

            var token = await _fixture.LoginAsync("waleed@revive.hr", "Revive!2026");
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/teams/{foreignTeam}/today", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Offboarding_InitiateAndList_Scoped()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var initiate = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/offboarding-requests", new
            {
                employeeId,
                lastWorkingDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(30),
                reason = "Personal reasons"
            }, token);
            var initiateResponse = await _fixture.Client.SendAsync(initiate);
            initiateResponse.EnsureSuccessStatusCode();
            var created = await initiateResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Notice Period", created.GetProperty("status").GetString());
            Assert.Equal("Karim Hassan", created.GetProperty("employee").GetString());

            var list = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/offboarding-requests", null, token);
            var listResponse = await _fixture.Client.SendAsync(list);
            listResponse.EnsureSuccessStatusCode();
            var listBody = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(listBody.GetProperty("items").EnumerateArray(), c => c.GetProperty("id").GetInt32() == created.GetProperty("id").GetInt32());

            // A second leaving process for the same employee is rejected.
            var duplicate = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/offboarding-requests", new
            {
                employeeId,
                lastWorkingDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(45),
                reason = "Changed mind"
            }, token);
            var duplicateResponse = await _fixture.Client.SendAsync(duplicate);
            Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);
        }

        [Fact]
        public async Task Offboarding_CrossGymEmployee_Returns404()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");

            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var initiate = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/offboarding-requests", new
            {
                employeeId = saraId,
                lastWorkingDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(30),
                reason = "Not your gym"
            }, token);
            var response = await _fixture.Client.SendAsync(initiate);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        // ---------- helpers ----------

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

        private async Task<int> AnyPositionIdAsync(int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Positions.Where(p => p.GymId == gymId).OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();
        }

        private async Task<int> AnyShiftTemplateIdAsync(int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var template = await db.ShiftTemplates.FirstOrDefaultAsync(t => t.GymId == gymId);
            if (template is not null)
            {
                return template.Id;
            }

            template = new DomainLayer.Models.SchedulingModule.ShiftTemplate
            {
                GymId = gymId,
                Name = "Morning Shift",
                StartTime = new TimeOnly(8, 0),
                EndTime = new TimeOnly(16, 0),
                IsActive = true
            };
            db.ShiftTemplates.Add(template);
            await db.SaveChangesAsync();
            return template.Id;
        }

        private async Task SeedAssignmentAsync(int employeeId, DateOnly date, int templateId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var employee = await db.Employees.FindAsync(employeeId);

            var cycle = await db.ShiftCycles.FirstOrDefaultAsync(c => c.GymId == employee!.GymId
                && c.StartDate <= date && c.EndDate >= date);
            if (cycle is null)
            {
                cycle = new DomainLayer.Models.SchedulingModule.ShiftCycle
                {
                    GymId = employee.GymId,
                    StartDate = date.AddDays(-1),
                    EndDate = date.AddDays(9),
                    Status = DomainLayer.Models.SchedulingModule.Enums.ShiftCycleStatus.Published,
                    PublishedAt = DateTime.UtcNow
                };
                db.ShiftCycles.Add(cycle);
                await db.SaveChangesAsync();
            }

            if (!await db.ShiftAssignments.AnyAsync(a => a.EmployeeId == employeeId && a.Date == date))
            {
                db.ShiftAssignments.Add(new DomainLayer.Models.SchedulingModule.ShiftAssignment
                {
                    ShiftCycleId = cycle.Id,
                    EmployeeId = employeeId,
                    Date = date,
                    ShiftTemplateId = templateId
                });
                await db.SaveChangesAsync();
            }
        }

        private async Task SeedAttendanceAsync(
            int employeeId, DateOnly date, DomainLayer.Models.AttendanceModule.Enums.AttendanceStatus status, TimeOnly checkIn)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var employee = await db.Employees.FindAsync(employeeId);

            if (await db.AttendanceRecords.AnyAsync(r => r.EmployeeId == employeeId && r.Date == date))
            {
                return;
            }

            var templateId = await db.ShiftAssignments
                .Where(a => a.EmployeeId == employeeId && a.Date == date)
                .Select(a => a.ShiftTemplateId)
                .FirstOrDefaultAsync();

            db.AttendanceRecords.Add(new DomainLayer.Models.AttendanceModule.AttendanceRecord
            {
                EmployeeId = employeeId,
                GymId = employee!.GymId,
                Date = date,
                CheckInTime = DateTime.SpecifyKind(date.ToDateTime(checkIn), DateTimeKind.Utc),
                CheckInMethod = DomainLayer.Models.AttendanceModule.Enums.AttendanceMethod.Manual,
                Status = status,
                ScheduledShiftTemplateId = templateId
            });
            await db.SaveChangesAsync();
        }

        private async Task<int> CreateEmployeeAsync(string email, int gymId, string employeeNumber)
        {
            var userId = await CreateUserAsync(email);
            return await CreateEmployeeForUserAsync(userId, gymId, employeeNumber);
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

            var positionId = await AnyPositionIdAsync(gymId);
            var fullName = userId switch
            {
                _ when employeeNumber.EndsWith("7001") => "On Time",
                _ when employeeNumber.EndsWith("7002") => "Late Comer",
                _ when employeeNumber.EndsWith("7003") => "No Show",
                _ when employeeNumber.EndsWith("7103") => "Leaving Comer",
                _ => "Scoped Tester"
            };

            var employee = new DomainLayer.Models.EmployeeModule.Employee
            {
                UserId = userId,
                GymId = gymId,
                PositionId = positionId,
                FullName = fullName,
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

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }
    }
}
