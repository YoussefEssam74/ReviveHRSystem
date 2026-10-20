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
    /// Team Actions (mock 19): follow-up CRUD, the "Remind" and "Message" shortcuts,
    /// and the scope rules — a Team Leader only touches his own team, out-of-scope
    /// targets answer 404, and the feature gate rejects View-only and plain employees.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class TeamActionsTests
    {
        private readonly ApiTestFixture _fixture;

        public TeamActionsTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task FollowUp_Create_List_Update_Resolution()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var seed = await SeedTeamWithLeaderAsync(gym1Id, "Actions Team", "act1@revive.hr");
            await SeedTeamMemberAsync(seed.TeamId, gym1Id, "actmember@revive.hr");

            var token = await _fixture.LoginAsync("act1@revive.hr", DevelopmentDataSeeder.EmployeePassword);

            var create = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/teams/follow-ups", new
            {
                employeeId = seed.MemberEmployeeId,
                action = "Reminder",
                severity = "High",
                description = "Late three times this week",
                note = "Spoke about the transport strike"
            }, token);
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();

            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Reminder", created.GetProperty("actionType").GetString());
            Assert.Equal("High", created.GetProperty("severity").GetString());
            Assert.False(created.GetProperty("isResolved").GetBoolean());

            var list = await GetAsync("/api/teams/follow-ups", token);
            Assert.Contains(list.EnumerateArray(), f => f.GetProperty("id").GetInt32() == created.GetProperty("id").GetInt32());

            // A resolution closes the item.
            var resolve = _fixture.AuthorizedRequest(
                HttpMethod.Put,
                $"/api/teams/follow-ups/{created.GetProperty("id").GetInt32()}",
                new { action = "Resolution", note = "Attendance back to normal" },
                token);
            var resolveResponse = await _fixture.Client.SendAsync(resolve);
            resolveResponse.EnsureSuccessStatusCode();

            var resolved = await resolveResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(resolved.GetProperty("isResolved").GetBoolean());
            Assert.Equal("Attendance back to normal", resolved.GetProperty("note").GetString());
        }

        [Fact]
        public async Task FollowUp_UnknownAction_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var seed = await SeedTeamWithLeaderAsync(gym1Id, "Bad Action Team", "act2@revive.hr");
            await SeedTeamMemberAsync(seed.TeamId, gym1Id, "actmember2@revive.hr");

            var token = await _fixture.LoginAsync("act2@revive.hr", DevelopmentDataSeeder.EmployeePassword);

            var create = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/teams/follow-ups", new
            {
                employeeId = seed.MemberEmployeeId,
                action = "Teleport",
                description = "Not a real action"
            }, token);
            var response = await _fixture.Client.SendAsync(create);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task FollowUp_NumericActionOrSeverity_Returns400()
        {
            // Enum.TryParse accepts numeric strings ("5" -> an undefined enum value),
            // so a name lookup alone would persist garbage. Both must be rejected.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var seed = await SeedTeamWithLeaderAsync(gym1Id, "Numeric Enum Team", "actnum@revive.hr");
            await SeedTeamMemberAsync(seed.TeamId, gym1Id, "actnummember@revive.hr");

            var token = await _fixture.LoginAsync("actnum@revive.hr", DevelopmentDataSeeder.EmployeePassword);

            var badAction = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/teams/follow-ups",
                new { employeeId = seed.MemberEmployeeId, action = "9", description = "Numeric action" }, token));
            Assert.Equal(HttpStatusCode.BadRequest, badAction.StatusCode);

            var badSeverity = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/teams/follow-ups",
                new { employeeId = seed.MemberEmployeeId, action = "Reminder", severity = "5", description = "Numeric severity" }, token));
            Assert.Equal(HttpStatusCode.BadRequest, badSeverity.StatusCode);
        }

        [Fact]
        public async Task FollowUp_OversizedDescription_Returns400()
        {
            // Column max is 1000: an oversized body must be a 400, not a DbUpdateException
            // surfacing as a 500.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var seed = await SeedTeamWithLeaderAsync(gym1Id, "Long Text Team", "actlong@revive.hr");
            await SeedTeamMemberAsync(seed.TeamId, gym1Id, "actlongmember@revive.hr");

            var token = await _fixture.LoginAsync("actlong@revive.hr", DevelopmentDataSeeder.EmployeePassword);

            var create = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/teams/follow-ups",
                new { employeeId = seed.MemberEmployeeId, action = "Reminder", description = new string('x', 1001) }, token));

            Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        }

        [Fact]
        public async Task Message_EmployeeOfAnotherGym_Returns404()
        {
            // The scope gym must come from the token, not from the target entity: a
            // dual-gym caller whose active session is gym1 must not reach a gym2 member.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var gym2Id = await GymIdByNameAsync("Revive Second Gym");
            var seed = await SeedTeamWithLeaderAsync(gym1Id, "Cross Gym Team", "actcross@revive.hr");

            var outsiderId = await SeedGym2OutsiderAsync(gym2Id, "actmsgoutsider@revive.hr");

            var token = await _fixture.LoginAsync("actcross@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var message = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/employees/{outsiderId}/messages",
                new { message = "Cross-gym message should never land." }, token));

            Assert.Equal(HttpStatusCode.NotFound, message.StatusCode);
        }

        [Fact]
        public async Task FollowUp_EmployeeOutsideCallersTeam_Returns404()
        {
            // The outsider works at the same gym but belongs to no team the caller leads.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var seed = await SeedTeamWithLeaderAsync(gym1Id, "Own Team Only", "act3@revive.hr");
            var outsiderId = await SeedTeamMemberAsync(seed.TeamId, gym1Id, "actoutsider@revive.hr");

            // Detach the outsider from the caller's team.
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var outsider = await db.Employees.FindAsync(outsiderId);
                outsider!.TeamId = null;
                await db.SaveChangesAsync();
            }

            var token = await _fixture.LoginAsync("act3@revive.hr", DevelopmentDataSeeder.EmployeePassword);

            var create = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/teams/follow-ups", new
            {
                employeeId = outsiderId,
                action = "Reminder",
                description = "You are not in my team"
            }, token);
            var response = await _fixture.Client.SendAsync(create);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task FollowUp_OtherTeamsFollowUp_Returns404()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var caller = await SeedTeamWithLeaderAsync(gym1Id, "Caller Team", "act4@revive.hr");
            await SeedTeamMemberAsync(caller.TeamId, gym1Id, "actmember4@revive.hr");
            var other = await SeedTeamWithLeaderAsync(gym1Id, "Other Team", "act5@revive.hr");
            var otherMemberId = await SeedTeamMemberAsync(other.TeamId, gym1Id, "actother@revive.hr");

            // The other leader raises a follow-up in his own team.
            var otherToken = await _fixture.LoginAsync("act5@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/teams/follow-ups", new
            {
                employeeId = otherMemberId,
                action = "Warning",
                description = "Quarterly check-in"
            }, otherToken);
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();

            // The caller cannot touch it, and never learns it exists.
            var token = await _fixture.LoginAsync("act4@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var update = _fixture.AuthorizedRequest(
                HttpMethod.Put,
                $"/api/teams/follow-ups/{created.GetProperty("id").GetInt32()}",
                new { action = "Resolution", note = "Closed by someone else" },
                token);
            var response = await _fixture.Client.SendAsync(update);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Reminder_RecordsFollowUp_AndNotifiesMember()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var seed = await SeedTeamWithLeaderAsync(gym1Id, "Reminder Team", "act6@revive.hr");
            var memberId = await SeedTeamMemberAsync(seed.TeamId, gym1Id, "actremind@revive.hr");

            var token = await _fixture.LoginAsync("act6@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/teams/members/{memberId}/reminders", null, token));

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

            // The member receives a notification in his own inbox.
            var memberToken = await _fixture.LoginAsync("actremind@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var memberNotifications = await GetAsync("/api/notifications?pageSize=100", memberToken);
            Assert.Contains(memberNotifications.GetProperty("items").EnumerateArray(),
                n => n.GetProperty("title").GetString() == "Reminder");
        }

        [Fact]
        public async Task Message_Persists_AndNotifiesMember()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var seed = await SeedTeamWithLeaderAsync(gym1Id, "Message Team", "act7@revive.hr");
            var memberId = await SeedTeamMemberAsync(seed.TeamId, gym1Id, "actmsg@revive.hr");

            var token = await _fixture.LoginAsync("act7@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post,
                $"/api/employees/{memberId}/messages",
                new { message = "Please review your shift swap request." },
                token));

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var stored = await db.TeamMessages
                .Where(m => m.ToEmployeeId == memberId)
                .Select(m => m.Body)
                .ToListAsync();
            Assert.Contains("Please review your shift swap request.", stored);
        }

        [Fact]
        public async Task FollowUp_WithoutToken_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/teams/follow-ups");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Reminder_BranchManager_TeamlessEmployee_Succeeds()
        {
            // The branch pages (attendance grid, employee directory) list the whole gym
            // roster, including employees nobody has put in a team yet. Reminding one of
            // them used to answer the scope 404 ("Employee not found.") because member
            // resolution was team-only — a Branch Manager covers his own gym's roster.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var (managerUserId, _) = await SeedGymEmployeeAsync(gym1Id, "actbm@revive.hr", "Branch Boss");
            var (_, teamlessId) = await SeedGymEmployeeAsync(gym1Id, "actteamless@revive.hr", "Unassigned Worker");

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                await SeedGymRoleAsync(db, managerUserId, gym1Id, "Branch Manager");
            }

            var token = await _fixture.LoginAsync("actbm@revive.hr", DevelopmentDataSeeder.EmployeePassword);

            var remind = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/teams/members/{teamlessId}/reminders", null, token));
            Assert.Equal(HttpStatusCode.NoContent, remind.StatusCode);

            // The message route resolves through the same scope and must reach him too.
            var message = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/employees/{teamlessId}/messages",
                new { message = "Please check the board." }, token));
            Assert.Equal(HttpStatusCode.NoContent, message.StatusCode);

            // The reminder still lands in his own inbox.
            var memberToken = await _fixture.LoginAsync("actteamless@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var notifications = await GetAsync("/api/notifications?pageSize=100", memberToken);
            Assert.Contains(notifications.GetProperty("items").EnumerateArray(),
                n => n.GetProperty("title").GetString() == "Reminder");
        }

        [Fact]
        public async Task FollowUp_TeamlessEmployee_BranchManager_Succeeds()
        {
            // A Branch Manager's scope is the whole gym roster (the same rows the branch
            // pages list), so an employee nobody has assigned to a team yet still takes a
            // follow-up — it simply hangs off no team — and shows up in his scope-wide
            // list. It used to answer "add him to a team first", which put an invented
            // rule in front of a manager acting on his own gym.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var (managerUserId, _) = await SeedGymEmployeeAsync(gym1Id, "actbm2@revive.hr", "Branch Boss Two");
            var (_, teamlessId) = await SeedGymEmployeeAsync(gym1Id, "actteamless2@revive.hr", "Unassigned Two");

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                await SeedGymRoleAsync(db, managerUserId, gym1Id, "Branch Manager");
            }

            var token = await _fixture.LoginAsync("actbm2@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/teams/follow-ups", new
            {
                employeeId = teamlessId,
                action = "Reminder",
                description = "Attendance slipped"
            }, token);
            var response = await _fixture.Client.SendAsync(create);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var created = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(teamlessId, created.GetProperty("employeeId").GetInt32());
            Assert.Equal(JsonValueKind.Null, created.GetProperty("teamId").ValueKind);

            // The team-less item is part of the Branch Manager's whole-scope list…
            var list = await GetAsync("/api/teams/follow-ups", token);
            Assert.Contains(list.EnumerateArray(), f => f.GetProperty("id").GetInt32() == created.GetProperty("id").GetInt32());

            // …and stays invisible to a Team Leader: he only ever sees his own team.
            var leader = await SeedTeamWithLeaderAsync(gym1Id, "Teamless Witness Team", "actbm2witness@revive.hr");
            var leaderToken = await _fixture.LoginAsync("actbm2witness@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var leaderList = await GetAsync("/api/teams/follow-ups", leaderToken);
            Assert.DoesNotContain(leaderList.EnumerateArray(), f => f.GetProperty("id").GetInt32() == created.GetProperty("id").GetInt32());

            // He cannot record an action on it either — it answers the concealment 404.
            var update = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put,
                $"/api/teams/follow-ups/{created.GetProperty("id").GetInt32()}",
                new { action = "Resolution", note = "Not mine" },
                leaderToken));
            Assert.Equal(HttpStatusCode.NotFound, update.StatusCode);
        }

        [Fact]
        public async Task Reminder_TeamLeader_TargetOutsideTeam_Returns404()
        {
            // Fail-closed stays: a plain Team Leader may not remind an employee who is
            // in no team he leads, even inside his own gym.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            _ = await SeedTeamWithLeaderAsync(gym1Id, "Scope Guard Team", "act8@revive.hr");
            var (_, teamlessId) = await SeedGymEmployeeAsync(gym1Id, "actteamless3@revive.hr", "Unassigned Three");

            var token = await _fixture.LoginAsync("act8@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var remind = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/teams/members/{teamlessId}/reminders", null, token));

            Assert.Equal(HttpStatusCode.NotFound, remind.StatusCode);
        }

        // ---------- helpers ----------

        private async Task<JsonElement> GetAsync(string url, string token)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, url, null, token);
            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }

        private async Task<(int TeamId, int MemberEmployeeId)> SeedTeamWithLeaderAsync(int gymId, string teamName, string leaderEmail)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<ServiceAbstraction.Services.IPasswordHasher>();

            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == leaderEmail);
            if (user is null)
            {
                user = new DomainLayer.Models.UserModule.User
                {
                    Email = leaderEmail,
                    UserName = leaderEmail.Split('@')[0],
                    PasswordHash = hasher.Hash(DevelopmentDataSeeder.EmployeePassword),
                    UserType = DomainLayer.Models.UserModule.Enums.UserType.Employee,
                    IsActive = true
                };
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }

            var positionId = await db.Positions.Where(p => p.GymId == gymId).OrderBy(p => p.Id)
                .Select(p => p.Id).FirstAsync();

            var leaderEmployee = await db.Employees.FirstOrDefaultAsync(e => e.UserId == user.Id);
            if (leaderEmployee is null)
            {
                leaderEmployee = new DomainLayer.Models.EmployeeModule.Employee
                {
                    UserId = user.Id,
                    GymId = gymId,
                    PositionId = positionId,
                    FullName = "Team Leader",
                    HireDate = new DateOnly(2026, 1, 5),
                    ContractType = "FullTime",
                    ContractStartDate = new DateOnly(2026, 1, 5),
                    Status = DomainLayer.Models.EmployeeModule.Enums.EmployeeStatus.Active,
                    // Unique per run: the seed data and other suites own the low numbers.
                    EmployeeNumber = NextEmployeeNumber()
                };
                db.Employees.Add(leaderEmployee);
                await db.SaveChangesAsync();
            }

            var team = new DomainLayer.Models.OrganizationModule.Team { GymId = gymId, Name = teamName };
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            db.TeamLeaders.Add(new DomainLayer.Models.OrganizationModule.TeamLeader
            {
                TeamId = team.Id,
                EmployeeId = leaderEmployee.Id
            });
            leaderEmployee.TeamId = team.Id;
            await db.SaveChangesAsync();

            // Without a gym-access row an employee cannot log in at all.
            if (!await db.UserGymAccesses.AnyAsync(a => a.UserId == user.Id && a.GymId == gymId))
            {
                db.UserGymAccesses.Add(new DomainLayer.Models.UserModule.UserGymAccess
                {
                    UserId = user.Id,
                    GymId = gymId
                });
                await db.SaveChangesAsync();
            }

            // The Team Leader role bundle grants the employees feature at Edit level
            // in this gym; without it the feature gate answers 403.
            await SeedGymRoleAsync(db, user.Id, gymId, "Team Leader");

            return (team.Id, leaderEmployee.Id);
        }

        /// <summary>
        /// Employee numbers are globally unique in the schema, and other suites plus the
        /// dev seed own the low ranges. Derive from the email so a number can never
        /// collide with one another test created.
        /// </summary>
        private static string NextEmployeeNumber() =>
            "EMP-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

        /// <summary>A plain employee of another gym, reachable only by a gym2 session.</summary>
        private async Task<int> SeedGym2OutsiderAsync(int gym2Id, string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<ServiceAbstraction.Services.IPasswordHasher>();

            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user is null)
            {
                user = new DomainLayer.Models.UserModule.User
                {
                    Email = email,
                    UserName = email.Split('@')[0],
                    PasswordHash = hasher.Hash(DevelopmentDataSeeder.EmployeePassword),
                    UserType = DomainLayer.Models.UserModule.Enums.UserType.Employee,
                    IsActive = true
                };
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }

            var positionId = await db.Positions.Where(p => p.GymId == gym2Id).OrderBy(p => p.Id)
                .Select(p => p.Id).FirstAsync();

            var employee = await db.Employees.FirstOrDefaultAsync(e => e.UserId == user.Id);
            if (employee is null)
            {
                employee = new DomainLayer.Models.EmployeeModule.Employee
                {
                    UserId = user.Id,
                    GymId = gym2Id,
                    PositionId = positionId,
                    FullName = "Gym Two Outsider",
                    EmployeeNumber = NextEmployeeNumber(),
                    HireDate = new DateOnly(2026, 1, 5),
                    ContractType = "FullTime",
                    ContractStartDate = new DateOnly(2026, 1, 5),
                    Status = DomainLayer.Models.EmployeeModule.Enums.EmployeeStatus.Active
                };
                db.Employees.Add(employee);
            }

            await db.SaveChangesAsync();
            return employee.Id;
        }

        /// <summary>
        /// A user + employee of the gym with a gym-access row (so he can log in) and no
        /// team membership — the state the branch pages list. Returns (UserId, EmployeeId).
        /// </summary>
        private async Task<(int UserId, int EmployeeId)> SeedGymEmployeeAsync(int gymId, string email, string fullName)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<ServiceAbstraction.Services.IPasswordHasher>();

            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user is null)
            {
                user = new DomainLayer.Models.UserModule.User
                {
                    Email = email,
                    UserName = email.Split('@')[0],
                    PasswordHash = hasher.Hash(DevelopmentDataSeeder.EmployeePassword),
                    UserType = DomainLayer.Models.UserModule.Enums.UserType.Employee,
                    IsActive = true
                };
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }

            var positionId = await db.Positions.Where(p => p.GymId == gymId).OrderBy(p => p.Id)
                .Select(p => p.Id).FirstAsync();

            var employee = await db.Employees.FirstOrDefaultAsync(e => e.UserId == user.Id);
            if (employee is null)
            {
                employee = new DomainLayer.Models.EmployeeModule.Employee
                {
                    UserId = user.Id,
                    GymId = gymId,
                    PositionId = positionId,
                    FullName = fullName,
                    HireDate = new DateOnly(2026, 1, 5),
                    ContractType = "FullTime",
                    ContractStartDate = new DateOnly(2026, 1, 5),
                    Status = DomainLayer.Models.EmployeeModule.Enums.EmployeeStatus.Active,
                    EmployeeNumber = NextEmployeeNumber()
                    // TeamId stays null: nobody has assigned him to a team yet.
                };
                db.Employees.Add(employee);
                await db.SaveChangesAsync();
            }

            // Without a gym-access row an employee cannot log in at all.
            if (!await db.UserGymAccesses.AnyAsync(a => a.UserId == user.Id && a.GymId == gymId))
            {
                db.UserGymAccesses.Add(new DomainLayer.Models.UserModule.UserGymAccess
                {
                    UserId = user.Id,
                    GymId = gymId
                });
                await db.SaveChangesAsync();
            }

            return (user.Id, employee.Id);
        }

        private static async Task SeedGymRoleAsync(ReviveHrDbContext db, int userId, int gymId, string roleName)
        {
            var roleId = await db.Roles.Where(r => r.Name == roleName).Select(r => r.Id).SingleAsync();
            if (!await db.UserGymRoles.AnyAsync(ugr => ugr.UserId == userId && ugr.GymId == gymId))
            {
                db.UserGymRoles.Add(new DomainLayer.Models.UserModule.UserGymRole
                {
                    UserId = userId,
                    GymId = gymId,
                    RoleId = roleId
                });
                await db.SaveChangesAsync();
            }
        }

        private async Task<int> SeedTeamMemberAsync(int teamId, int gymId, string email) {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<ServiceAbstraction.Services.IPasswordHasher>();

            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user is null)
            {
                user = new DomainLayer.Models.UserModule.User
                {
                    Email = email,
                    UserName = email.Split('@')[0],
                    PasswordHash = hasher.Hash(DevelopmentDataSeeder.EmployeePassword),
                    UserType = DomainLayer.Models.UserModule.Enums.UserType.Employee,
                    IsActive = true
                };
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }

            var positionId = await db.Positions.Where(p => p.GymId == gymId).OrderBy(p => p.Id)
                .Select(p => p.Id).FirstAsync();

            var employee = await db.Employees.FirstOrDefaultAsync(e => e.UserId == user.Id);
            if (employee is null)
            {
                employee = new DomainLayer.Models.EmployeeModule.Employee
                {
                    UserId = user.Id,
                    GymId = gymId,
                    PositionId = positionId,
                    FullName = "Team Member",
                    HireDate = new DateOnly(2026, 1, 5),
                    ContractType = "FullTime",
                    ContractStartDate = new DateOnly(2026, 1, 5),
                    Status = DomainLayer.Models.EmployeeModule.Enums.EmployeeStatus.Active,
                    EmployeeNumber = NextEmployeeNumber()
                };
                db.Employees.Add(employee);
            }

            employee.TeamId = teamId;
            await db.SaveChangesAsync();

            // Without a gym-access row an employee cannot log in at all.
            if (!await db.UserGymAccesses.AnyAsync(a => a.UserId == user.Id && a.GymId == gymId))
            {
                db.UserGymAccesses.Add(new DomainLayer.Models.UserModule.UserGymAccess
                {
                    UserId = user.Id,
                    GymId = gymId
                });
                await db.SaveChangesAsync();
            }

            return employee.Id;
        }
    }
}
