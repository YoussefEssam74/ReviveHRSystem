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
    /// Evaluation authoring (mock 14.6/14.7/18.1): form listing, submit, edit, and the
    /// scope rules — the target employee must be in the caller's scope and every
    /// answer must belong to the selected form.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class EvaluationManagementTests
    {
        private readonly ApiTestFixture _fixture;

        public EvaluationManagementTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Create_Then_ReadAsSelf_ShowsCriteriaAndScore()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            // A per-run form name keeps the test independent of rows earlier runs left behind.
            var (formId, questionId) = await SeedEvaluationFormAsync(gym1Id, $"Q4 Rating {Guid.NewGuid():N}");
            var memberId = await EnsureEvaluationTargetAsync("evreader@revive.hr");

            var token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{memberId}/evaluations", new
            {
                evaluationFormId = formId,
                answers = new[] { new { questionId, score = 4, comment = "Consistently on time" } },
                overallComment = "Strong quarter."
            }, token);
            var response = await _fixture.Client.SendAsync(create);
            response.EnsureSuccessStatusCode();

            var created = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(4, created.GetProperty("score").GetDecimal());
            Assert.Equal("Completed", created.GetProperty("status").GetString());
            Assert.NotEmpty(created.GetProperty("criteria").EnumerateArray());

            // The HR portal's employee-file tab lists the submitted review. That tab is
            // guarded by the flat employees.view key, which the seeded HR account does
            // not carry, so the read is asserted through the Top Management session.
            var list = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{memberId}/evaluations", null, await _fixture.GetAdminTokenAsync());
            var listResponse = await _fixture.Client.SendAsync(list);
            listResponse.EnsureSuccessStatusCode();
            var own = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(own.GetProperty("items").EnumerateArray().Any(e => e.GetProperty("id").GetInt32() == created.GetProperty("id").GetInt32()));
        }

        [Fact]
        public async Task Create_AnswerFromAnotherForm_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var (formId, _) = await SeedEvaluationFormAsync(gym1Id, "Q4 Form A");
            var (_, otherQuestionId) = await SeedEvaluationFormAsync(gym1Id, "Q4 Form B");
            var memberId = await EnsureEvaluationTargetAsync("evforeign@revive.hr");

            var token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{memberId}/evaluations", new
            {
                evaluationFormId = formId,
                answers = new[] { new { questionId = otherQuestionId, score = 5 } }
            }, token);
            var response = await _fixture.Client.SendAsync(create);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Create_EmployeeOfAnotherGym_Returns404()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var (formId, questionId) = await SeedEvaluationFormAsync(gym1Id, "Q4 Scope");
            var outsiderId = await OwnEmployeeIdAsync("sara@revive.hr");

            var token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{outsiderId}/evaluations", new
            {
                evaluationFormId = formId,
                answers = new[] { new { questionId, score = 3 } }
            }, token);
            var response = await _fixture.Client.SendAsync(create);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Update_ChangesTheScore()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var (formId, questionId) = await SeedEvaluationFormAsync(gym1Id, "Q4 Edit");
            var memberId = await EnsureEvaluationTargetAsync("eveditor@revive.hr");

            var token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");

            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{memberId}/evaluations", new
            {
                evaluationFormId = formId,
                answers = new[] { new { questionId, score = 2 } }
            }, token);
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            var evaluationId = created.GetProperty("id").GetInt32();

            var update = _fixture.AuthorizedRequest(
                HttpMethod.Put,
                $"/api/employees/{memberId}/evaluations/{evaluationId}",
                new { answers = new[] { new { questionId, score = 5 } } },
                token);
            var updateResponse = await _fixture.Client.SendAsync(update);
            updateResponse.EnsureSuccessStatusCode();

            var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(5, updated.GetProperty("score").GetDecimal());
        }

        [Fact]
        public async Task TeamEvaluations_SeesOnlyTeamMembers()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var seed = await SeedTeamWithLeaderAsync(gym1Id, "Eval Team List", "ev6@revive.hr");
            var memberId = await SeedTeamMemberAsync(seed.TeamId, gym1Id, "evmember6@revive.hr");
            var outsiderId = await EnsureEvaluationTargetAsync("evoutsider@revive.hr");
            var (formId, questionId) = await SeedEvaluationFormAsync(gym1Id, "Q4 Team");

            // HR authors the evaluations (it holds evaluations at Edit); the leader reads.
            var hrToken = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{memberId}/evaluations", new
            {
                evaluationFormId = formId,
                answers = new[] { new { questionId, score = 4 } }
            }, hrToken);
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();

            // An evaluation of an employee outside the team must not surface to the leader.
            var outsiderCreate = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{outsiderId}/evaluations", new
            {
                evaluationFormId = formId,
                answers = new[] { new { questionId, score = 1 } }
            }, hrToken);
            (await _fixture.Client.SendAsync(outsiderCreate)).EnsureSuccessStatusCode();

            var token = await _fixture.LoginAsync("ev6@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var body = await GetAsync($"/api/teams/{seed.TeamId}/evaluations", token);

            var ids = body.EnumerateArray().Select(e => e.GetProperty("id").GetInt32()).ToList();
            Assert.Contains(created.GetProperty("id").GetInt32(), ids);
            Assert.Single(ids);
        }

        [Fact]
        public async Task Create_ScoreOutOfRange_Returns400()
        {
            // MaxScore is hard-coded 5, so an unbounded score would poison the average
            // and the history display alike.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var (formId, questionId) = await SeedEvaluationFormAsync(gym1Id, "Q4 Score Bounds");
            var memberId = await EnsureEvaluationTargetAsync("evscore@revive.hr");

            var token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{memberId}/evaluations", new
            {
                evaluationFormId = formId,
                answers = new[] { new { questionId, score = 99 } }
            }, token);
            var response = await _fixture.Client.SendAsync(create);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Create_RoundTripsTheOverallComment()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var (formId, questionId) = await SeedEvaluationFormAsync(gym1Id, "Q4 Comment");
            var memberId = await EnsureEvaluationTargetAsync("evcomment@revive.hr");

            var token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{memberId}/evaluations", new
            {
                evaluationFormId = formId,
                answers = new[] { new { questionId, score = 4 } },
                overallComment = "Strong quarter, keep it up."
            }, token);
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();

            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Strong quarter, keep it up.", created.GetProperty("overallComment").GetString());
        }

        [Fact]
        public async Task Update_EmployeeOfAnotherGym_Returns404()
        {
            // The active gym must come from the token, so an evaluation of a gym2
            // employee is invisible to a gym1 session even if the caller legitimately
            // holds the permission in that other gym.
            var gym2Id = await GymIdByNameAsync("Revive Second Gym");
            var (formId, questionId) = await SeedEvaluationFormAsync(gym2Id, "Q4 Gym2 Form");
            var gym2MemberId = await EnsureEvaluationTargetAsync("evgym2target@revive.hr", gym2Id);
            var evaluationId = await SeedEvaluationAsync(gym2MemberId, formId, questionId);

            // A gym1-scoped HR session must not see it, whatever it holds in gym2.
            var gym1Token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");
            var update = _fixture.AuthorizedRequest(
                HttpMethod.Put,
                $"/api/employees/{gym2MemberId}/evaluations/{evaluationId}",
                new { answers = new[] { new { questionId, score = 1 } } },
                gym1Token);

            Assert.Equal(HttpStatusCode.NotFound, (await _fixture.Client.SendAsync(update)).StatusCode);
        }

        [Fact]
        public async Task Update_MismatchedRouteEmployee_Returns404()
        {
            // The employeeId in the path must match the evaluation's employee, so a
            // crafted URL cannot address one employee's evaluation through another.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var (formId, questionId) = await SeedEvaluationFormAsync(gym1Id, "Q4 Route Mismatch");
            var ownerId = await EnsureEvaluationTargetAsync("evrouteowner@revive.hr");
            var otherId = await EnsureEvaluationTargetAsync("evrouteother@revive.hr");

            var token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{ownerId}/evaluations", new
            {
                evaluationFormId = formId,
                answers = new[] { new { questionId, score = 4 } }
            }, token);
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            var evaluationId = created.GetProperty("id").GetInt32();

            var update = _fixture.AuthorizedRequest(
                HttpMethod.Put,
                $"/api/employees/{otherId}/evaluations/{evaluationId}",
                new { answers = new[] { new { questionId, score = 1 } } },
                token);

            Assert.Equal(HttpStatusCode.NotFound, (await _fixture.Client.SendAsync(update)).StatusCode);
        }

        /// <summary>Persists an evaluation directly, for tests that need pre-existing data.</summary>
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
        private async Task<int> SeedEvaluationAsync(int employeeId, int formId, int questionId, decimal score = 4)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var evaluatorId = (await db.Users.FirstAsync(u => u.Email == "hr@revive.hr")).Id;

            var response = new DomainLayer.Models.EvaluationModule.EvaluationResponse
            {
                EvaluationFormId = formId,
                EmployeeId = employeeId,
                EvaluatedBy = evaluatorId,
                SubmittedAt = DateTime.UtcNow
            };
            db.EvaluationResponses.Add(response);
            await db.SaveChangesAsync();

            db.EvaluationAnswers.Add(new DomainLayer.Models.EvaluationModule.EvaluationAnswer
            {
                EvaluationResponseId = response.Id,
                EvaluationQuestionId = questionId,
                AnswerValueJson = System.Text.Json.JsonSerializer.Serialize(new { score, comment = (string?)null })
            });
            await db.SaveChangesAsync();

            return response.Id;
        }
        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }

        /// <summary>
        /// A plain employee used as an evaluation target. Each test gets its own so the
        /// seeded suites' assertions on karim/sara stay deterministic.
        /// </summary>
        private async Task<int> EnsureEvaluationTargetAsync(string email, int gymId = 1)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<ServiceAbstraction.Services.IPasswordHasher>();

            var existing = await db.Employees.FirstOrDefaultAsync(e => e.User!.Email == email);
            if (existing is not null)
            {
                return existing.Id;
            }

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

            var positionId = await db.Positions.Where(p => p.GymId == gymId).OrderBy(p => p.Id)
                .Select(p => p.Id).FirstAsync();

            var employee = new DomainLayer.Models.EmployeeModule.Employee
            {
                UserId = user.Id,
                GymId = gymId,
                PositionId = positionId,
                FullName = "Eval Target " + email.Split('@')[0],
                EmployeeNumber = "EMP-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
                HireDate = new DateOnly(2026, 1, 5),
                ContractType = "FullTime",
                ContractStartDate = new DateOnly(2026, 1, 5),
                Status = DomainLayer.Models.EmployeeModule.Enums.EmployeeStatus.Active
            };
            db.Employees.Add(employee);
            await db.SaveChangesAsync();

            // Without a gym-access row an employee cannot log in at all, and the test
            // needs the member's own token to read his evaluation.
            db.UserGymAccesses.Add(new DomainLayer.Models.UserModule.UserGymAccess
            {
                UserId = user.Id,
                GymId = gymId
            });
            await db.SaveChangesAsync();

            return employee.Id;
        }

        private async Task<(int FormId, int QuestionId)> SeedEvaluationFormAsync(int gymId, string formName)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();

            var existing = await db.EvaluationForms
                .Include(f => f.Questions)
                .FirstOrDefaultAsync(f => f.Name == formName);
            if (existing is not null)
            {
                return (existing.Id, existing.Questions.First().Id);
            }

            var form = new DomainLayer.Models.EvaluationModule.EvaluationForm
            {
                Name = formName,
                GymId = gymId,
                IsActive = true
            };
            db.EvaluationForms.Add(form);
            await db.SaveChangesAsync();

            var question = new DomainLayer.Models.EvaluationModule.EvaluationQuestion
            {
                EvaluationFormId = form.Id,
                QuestionText = "Punctuality & Attendance",
                QuestionType = DomainLayer.Models.EvaluationModule.Enums.EvaluationQuestionType.Rating5,
                SortOrder = 1
            };
            db.EvaluationQuestions.Add(question);
            await db.SaveChangesAsync();

            return (form.Id, question.Id);
        }

        private async Task<(int TeamId, int MemberEmployeeId)> SeedTeamWithLeaderAsync(
            int gymId, string teamName, string leaderEmail)
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
                    EmployeeNumber = "EMP-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
                    HireDate = new DateOnly(2026, 1, 5),
                    ContractType = "FullTime",
                    ContractStartDate = new DateOnly(2026, 1, 5),
                    Status = DomainLayer.Models.EmployeeModule.Enums.EmployeeStatus.Active
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

            if (!await db.UserGymAccesses.AnyAsync(a => a.UserId == user.Id && a.GymId == gymId))
            {
                db.UserGymAccesses.Add(new DomainLayer.Models.UserModule.UserGymAccess
                {
                    UserId = user.Id,
                    GymId = gymId
                });
                await db.SaveChangesAsync();
            }

            var roleId = await db.Roles.Where(r => r.Name == "Team Leader").Select(r => r.Id).SingleAsync();
            if (!await db.UserGymRoles.AnyAsync(ugr => ugr.UserId == user.Id && ugr.GymId == gymId))
            {
                db.UserGymRoles.Add(new DomainLayer.Models.UserModule.UserGymRole
                {
                    UserId = user.Id,
                    GymId = gymId,
                    RoleId = roleId
                });
                await db.SaveChangesAsync();
            }

            return (team.Id, leaderEmployee.Id);
        }

        private async Task<int> SeedTeamMemberAsync(int teamId, int gymId, string email)
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
                    FullName = "Team Member",
                    EmployeeNumber = "EMP-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
                    HireDate = new DateOnly(2026, 1, 5),
                    ContractType = "FullTime",
                    ContractStartDate = new DateOnly(2026, 1, 5),
                    Status = DomainLayer.Models.EmployeeModule.Enums.EmployeeStatus.Active
                };
                db.Employees.Add(employee);
            }

            employee.TeamId = teamId;
            await db.SaveChangesAsync();

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
