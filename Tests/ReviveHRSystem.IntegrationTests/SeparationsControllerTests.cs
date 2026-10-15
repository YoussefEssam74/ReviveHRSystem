using System.Net;
using System.Text.Json;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Separations / exit lifecycle (api-spec-from-ui.md §5.6 T1–T6 + E19): the
    /// pipeline list/detail, the HR-initiated offboard (E19) and the Branch-Manager
    /// termination request (T2) sharing one case core, the five-task exit checklist
    /// (T3), stage moves (T4), the HR exit verdict (T5), and finalize (T6) which
    /// archives the employee — Terminated, login cut, "Employee Offboarded" audit
    /// (deliberate deviations from the mock's Suspended, documented in api.md).
    /// Reads need employees.view; every mutation needs employees.offboard.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class SeparationsControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public SeparationsControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        private ReviveHrDbContext Db => _fixture.Services.GetRequiredService<ReviveHrDbContext>();

        private sealed record Scene(TestDataBuilder Builder, TestGym Gym, TestUser Hr, TestEmployee Employee, string Token);

        private async Task<Scene> CreateSceneAsync(params string[] permissionKeys)
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            foreach (var key in permissionKeys)
            {
                await builder.GrantPermissionAsync(hr.UserId, key);
            }

            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var employee = await builder.CreateEmployeeAsync(gym);
            return new Scene(builder, gym, hr, employee, token);
        }

        private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body, string token)
            => await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(method, url, body, token));

        private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
        {
            var body = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        private async Task<JsonElement> GetAsync(string url, string token)
        {
            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(HttpMethod.Get, url, null, token));
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from {url} but got {(int)response.StatusCode}: {body}");
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        private static async Task<string> AssertErrorAsync(HttpResponseMessage response, HttpStatusCode expected)
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == expected,
                $"Expected {(int)expected} but got {(int)response.StatusCode}: {body}");
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.GetProperty("errorMessage").GetString() ?? string.Empty;
        }

        private static List<JsonElement> ItemsOf(JsonElement envelope) =>
            envelope.GetProperty("items").EnumerateArray().ToList();

        private static DateOnly Days(int offset) => DateOnly.FromDateTime(DateTime.UtcNow.AddDays(offset));

        private static string Iso(DateOnly date) => date.ToString("yyyy-MM-dd");

        private async Task<int> OffboardAsync(Scene scene, TestEmployee employee, object body)
        {
            var response = await SendAsync(HttpMethod.Post, $"/api/employees/{employee.EmployeeId}/offboard", body, scene.Token);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await ReadAsync(response)).GetProperty("data").GetProperty("separationId").GetInt32();
        }

        private async Task<int> RequestTerminationAsync(Scene scene, TestEmployee employee, object body)
        {
            var response = await SendAsync(HttpMethod.Post, "/api/separations", body, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await ReadAsync(response)).GetProperty("data").GetProperty("id").GetInt32();
        }

        // ------------------------------------------------------------------
        // Auth
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetSeparations_WithoutEmployeesView_Returns401()
        {
            var scene = await CreateSceneAsync(); // no keys
            var response = await SendAsync(HttpMethod.Get, "/api/separations", null, scene.Token);
            await AssertErrorAsync(response, HttpStatusCode.Unauthorized);
        }

        [Fact]
        public async Task Offboard_WithoutOffboardPermission_Returns401()
        {
            var scene = await CreateSceneAsync("employees.view");
            var response = await SendAsync(HttpMethod.Post, $"/api/employees/{scene.Employee.EmployeeId}/offboard",
                new { lastDay = Iso(Days(5)), reason = "Relocation" }, scene.Token);
            await AssertErrorAsync(response, HttpStatusCode.Unauthorized);
        }

        [Fact]
        public async Task Detail_UnknownSeparation_Returns404()
        {
            var scene = await CreateSceneAsync("employees.view");
            var response = await SendAsync(HttpMethod.Get, "/api/separations/9999999", null, scene.Token);
            var message = await AssertErrorAsync(response, HttpStatusCode.NotFound);
            Assert.Contains("Separation not found", message);
        }

        [Fact]
        public async Task Detail_FromAnotherGym_Returns401()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await OffboardAsync(scene, scene.Employee,
                new { lastDay = Iso(Days(6)), reason = "Relocation" });

            var otherGym = await scene.Builder.CreateGymWithStationAsync();
            var outsider = await scene.Builder.CreateUserAsync(UserType.HR, new[] { otherGym });
            await scene.Builder.GrantPermissionAsync(outsider.UserId, "employees.view");
            var outsiderToken = await _fixture.LoginAsync(outsider.Email, outsider.Password);

            var response = await SendAsync(HttpMethod.Get, $"/api/separations/{separationId}", null, outsiderToken);
            await AssertErrorAsync(response, HttpStatusCode.Unauthorized);
        }

        // ------------------------------------------------------------------
        // E19 — HR-initiated offboarding
        // ------------------------------------------------------------------

        [Fact]
        public async Task Offboard_CreatesNoticePeriodCase_AndMovesEmployee()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            await scene.Builder.SetLeaveBalanceAsync(scene.Employee.EmployeeId, total: 10, used: 5);
            var lastDay = Days(6);

            var separationId = await OffboardAsync(scene, scene.Employee,
                new { lastDay = Iso(lastDay), reason = "Relocation", notes = "Moving abroad" });

            // The case: Notice Period (the mock's submitInitiateOffboarding), Resignation by default.
            var list = await GetAsync("/api/separations", scene.Token);
            var item = Assert.Single(ItemsOf(list), i => i.GetProperty("id").GetInt32() == separationId);
            Assert.Equal("Notice Period", item.GetProperty("status").GetString());
            Assert.Equal("Resignation", item.GetProperty("separationType").GetString());
            Assert.Equal(0, item.GetProperty("progress").GetInt32());
            Assert.Equal("HR Manager", item.GetProperty("requestedBy").GetString());
            Assert.Equal(scene.Hr.Email.Split('@')[0], item.GetProperty("requestedByUser").GetString());
            Assert.Equal(scene.Employee.FullName, item.GetProperty("employee").GetString());
            Assert.Equal("IT Tester", item.GetProperty("position").GetString());
            Assert.Equal(scene.Gym.Name, item.GetProperty("gym").GetString());
            Assert.Equal(Iso(lastDay), item.GetProperty("lastDay").GetString());
            Assert.Equal(5m, item.GetProperty("leaveTaken").GetDecimal());
            Assert.Equal("Relocation", item.GetProperty("reason").GetString());

            var checklist = item.GetProperty("checklist").EnumerateArray().ToList();
            Assert.Equal(5, checklist.Count);
            Assert.Equal("Exit interview scheduled", checklist[0][0].GetString());
            Assert.False(checklist[0][1].GetBoolean());

            // Detail carries no verdict yet.
            var detail = (await GetAsync($"/api/separations/{separationId}", scene.Token)).GetProperty("data");
            Assert.Equal(JsonValueKind.Null, detail.GetProperty("verdict").ValueKind);

            // Employee parked in Notice Period + audit row.
            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == scene.Employee.EmployeeId);
            Assert.Equal(EmployeeStatus.NoticePeriod, employee.Status);
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Offboarding Initiated" && a.UserId == scene.Hr.UserId));
        }

        [Fact]
        public async Task Offboard_DerivesTerminationFromReason_InvalidTypeRejected()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");

            var second = await scene.Builder.CreateEmployeeAsync(scene.Gym);
            var separationId = await OffboardAsync(scene, second,
                new { lastDay = Iso(Days(9)), reason = "Performance Termination" });
            var case1 = await Db.OffboardingCases.AsNoTracking().SingleAsync(c => c.Id == separationId);
            Assert.Equal("Termination", case1.SeparationType);

            var third = await scene.Builder.CreateEmployeeAsync(scene.Gym);
            var badType = await SendAsync(HttpMethod.Post, $"/api/employees/{third.EmployeeId}/offboard",
                new { lastDay = Iso(Days(9)), reason = "Leaving", separationType = "Mutual" }, scene.Token);
            var message = await AssertErrorAsync(badType, HttpStatusCode.BadRequest);
            Assert.Contains("Resignation", message);
        }

        [Fact]
        public async Task Offboard_DuplicateOpenCase_Returns400()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            await OffboardAsync(scene, scene.Employee, new { lastDay = Iso(Days(6)), reason = "Relocation" });

            var again = await SendAsync(HttpMethod.Post, $"/api/employees/{scene.Employee.EmployeeId}/offboard",
                new { lastDay = Iso(Days(7)), reason = "Changed my mind" }, scene.Token);
            var message = await AssertErrorAsync(again, HttpStatusCode.BadRequest);
            Assert.Contains("already has an exit in progress", message);
        }

        // ------------------------------------------------------------------
        // T2 — Branch-Manager termination request
        // ------------------------------------------------------------------

        [Fact]
        public async Task TerminationRequest_Valid_CreatesRequestedTermination()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var lastDay = Days(12);

            var separationId = await RequestTerminationAsync(scene, scene.Employee, new
            {
                employeeId = scene.Employee.EmployeeId,
                lastDay = Iso(lastDay),
                reason = "Misconduct / policy breach",
                notes = "Second warning logged",
            });

            var item = (await GetAsync($"/api/separations/{separationId}", scene.Token)).GetProperty("data");
            Assert.Equal("Requested", item.GetProperty("status").GetString());
            Assert.Equal("Termination", item.GetProperty("separationType").GetString());
            Assert.Equal("Misconduct / policy breach", item.GetProperty("reason").GetString());
            Assert.Equal("HR Manager", item.GetProperty("requestedBy").GetString());
            Assert.Equal(0, item.GetProperty("progress").GetInt32());

            // T2 does NOT move the employee's standing (unlike E19).
            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == scene.Employee.EmployeeId);
            Assert.Equal(EmployeeStatus.Active, employee.Status);
        }

        [Fact]
        public async Task TerminationRequest_OutsideReasonVocabulary_Returns400()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var response = await SendAsync(HttpMethod.Post, "/api/separations", new
            {
                employeeId = scene.Employee.EmployeeId,
                lastDay = Iso(Days(12)),
                reason = "They were mean to me",
            }, scene.Token);
            var message = await AssertErrorAsync(response, HttpStatusCode.BadRequest);
            Assert.Contains("Invalid termination reason", message);
            Assert.Contains("Performance issues", message);
        }

        [Fact]
        public async Task TerminationRequest_WithoutOffboardPermission_Returns401()
        {
            var scene = await CreateSceneAsync("employees.view");
            var response = await SendAsync(HttpMethod.Post, "/api/separations", new
            {
                employeeId = scene.Employee.EmployeeId,
                lastDay = Iso(Days(12)),
                reason = "Performance issues",
            }, scene.Token);
            await AssertErrorAsync(response, HttpStatusCode.Unauthorized);
        }

        // ------------------------------------------------------------------
        // T1 — list filters + pagination
        // ------------------------------------------------------------------

        [Fact]
        public async Task List_FiltersByStatusAndType_Paginates()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var second = await scene.Builder.CreateEmployeeAsync(scene.Gym);

            await OffboardAsync(scene, scene.Employee, new { lastDay = Iso(Days(6)), reason = "Relocation" });
            await RequestTerminationAsync(scene, second, new
            {
                employeeId = second.EmployeeId,
                lastDay = Iso(Days(14)),
                reason = "Restructuring / redundancy",
            });

            var all = await GetAsync("/api/separations", scene.Token);
            Assert.Equal(2, all.GetProperty("total").GetInt32());

            var requested = await GetAsync("/api/separations?status=requested", scene.Token);
            var only = Assert.Single(ItemsOf(requested));
            Assert.Equal("Requested", only.GetProperty("status").GetString());
            Assert.Equal("Termination", only.GetProperty("separationType").GetString());

            var resignations = await GetAsync("/api/separations?type=resignation", scene.Token);
            Assert.Single(ItemsOf(resignations), i => i.GetProperty("separationType").GetString() == "Resignation");

            var paged = await GetAsync("/api/separations?page=1&pageSize=1", scene.Token);
            Assert.Single(ItemsOf(paged));
            Assert.Equal(2, paged.GetProperty("total").GetInt32());
            Assert.Equal(2, paged.GetProperty("totalPages").GetInt32());
        }

        // ------------------------------------------------------------------
        // T3 — exit checklist
        // ------------------------------------------------------------------

        [Fact]
        public async Task Checklist_FirstTick_MovesToExitInProgress()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await OffboardAsync(scene, scene.Employee,
                new { lastDay = Iso(Days(6)), reason = "Relocation" });

            var tick = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/checklist",
                new { index = 0, done = true }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, tick.StatusCode);
            var data = (await ReadAsync(tick)).GetProperty("data");
            Assert.Equal(20, data.GetProperty("progress").GetInt32());
            Assert.Equal("Exit In Progress", data.GetProperty("status").GetString());

            // Unticking keeps the stage (only the first tick promotes).
            var untick = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/checklist",
                new { index = 0, done = false }, scene.Token);
            var undone = (await ReadAsync(untick)).GetProperty("data");
            Assert.Equal(0, undone.GetProperty("progress").GetInt32());
            Assert.Equal("Exit In Progress", undone.GetProperty("status").GetString());

            var badIndex = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/checklist",
                new { index = 9, done = true }, scene.Token);
            var message = await AssertErrorAsync(badIndex, HttpStatusCode.BadRequest);
            Assert.Contains("Unknown checklist item", message);
        }

        [Fact]
        public async Task Checklist_WithoutOffboardPermission_Returns401()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await OffboardAsync(scene, scene.Employee,
                new { lastDay = Iso(Days(6)), reason = "Relocation" });

            var viewer = await scene.Builder.CreateUserAsync(UserType.HR, new[] { scene.Gym });
            await scene.Builder.GrantPermissionAsync(viewer.UserId, "employees.view");
            var viewerToken = await _fixture.LoginAsync(viewer.Email, viewer.Password);

            var response = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/checklist",
                new { index = 0, done = true }, viewerToken);
            await AssertErrorAsync(response, HttpStatusCode.Unauthorized);
        }

        // ------------------------------------------------------------------
        // T4 — stage moves
        // ------------------------------------------------------------------

        [Fact]
        public async Task Stage_UnknownStatus_Returns400()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await OffboardAsync(scene, scene.Employee,
                new { lastDay = Iso(Days(6)), reason = "Relocation" });

            var response = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/stage",
                new { status = "Bogus" }, scene.Token);
            var message = await AssertErrorAsync(response, HttpStatusCode.BadRequest);
            Assert.Contains("Status must be", message);
        }

        [Fact]
        public async Task Stage_Completed_AutoTicksWholeChecklist()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await OffboardAsync(scene, scene.Employee,
                new { lastDay = Iso(Days(6)), reason = "Relocation" });

            var response = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/stage",
                new { status = "Completed" }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains("Completed", (await ReadAsync(response)).GetProperty("message").GetString());

            var detail = (await GetAsync($"/api/separations/{separationId}", scene.Token)).GetProperty("data");
            Assert.Equal("Completed", detail.GetProperty("status").GetString());
            Assert.Equal(100, detail.GetProperty("progress").GetInt32());
            Assert.All(detail.GetProperty("checklist").EnumerateArray(), entry => Assert.True(entry[1].GetBoolean()));

            // Idempotent repeat.
            var again = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/stage",
                new { status = "Completed" }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        }

        // ------------------------------------------------------------------
        // T5 — exit verdict
        // ------------------------------------------------------------------

        [Fact]
        public async Task Verdict_InvalidVocabulary_Returns400_ValidMovesToUnderReview()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await OffboardAsync(scene, scene.Employee,
                new { lastDay = Iso(Days(6)), reason = "Relocation" });

            var badDirection = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/verdict",
                new
                {
                    finalReason = "Mutual agreement",
                    settlement = new { direction = "maybe", amount = 0 },
                    rehire = new { status = "Eligible" },
                }, scene.Token);
            var directionMessage = await AssertErrorAsync(badDirection, HttpStatusCode.BadRequest);
            Assert.Contains("Settlement direction", directionMessage);

            var badRehire = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/verdict",
                new
                {
                    finalReason = "Mutual agreement",
                    settlement = new { direction = "none", amount = 0 },
                    rehire = new { status = "Maybe" },
                }, scene.Token);
            var rehireMessage = await AssertErrorAsync(badRehire, HttpStatusCode.BadRequest);
            Assert.Contains("Rehire status", rehireMessage);

            var valid = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/verdict",
                new
                {
                    finalReason = "Mutual agreement, probation extension declined",
                    settlement = new { direction = "owedToEmployee", amount = 1500.5, note = "Final week prorated" },
                    rehire = new { status = "Eligible", note = "Reapply after relocation" },
                }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, valid.StatusCode);
            Assert.Equal("Exit verdict saved.", (await ReadAsync(valid)).GetProperty("message").GetString());

            var detail = (await GetAsync($"/api/separations/{separationId}", scene.Token)).GetProperty("data");
            Assert.Equal("Under Review", detail.GetProperty("status").GetString());
            var verdict = detail.GetProperty("verdict");
            Assert.Equal("Mutual agreement, probation extension declined", verdict.GetProperty("finalReason").GetString());
            Assert.Equal("owedToEmployee", verdict.GetProperty("settlement").GetProperty("direction").GetString());
            Assert.Equal(1500.5m, verdict.GetProperty("settlement").GetProperty("amount").GetDecimal());
            Assert.Equal("Eligible", verdict.GetProperty("rehire").GetProperty("status").GetString());
        }

        // ------------------------------------------------------------------
        // T6 — finalize
        // ------------------------------------------------------------------

        [Fact]
        public async Task Finalize_GatesOnChecklistAndVerdict_ThenArchivesEmployee()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await OffboardAsync(scene, scene.Employee,
                new { lastDay = Iso(Days(6)), reason = "Relocation", notes = "Moving abroad" });

            // Gate 1 — checklist incomplete.
            var early = await SendAsync(HttpMethod.Post, $"/api/separations/{separationId}/finalize", null, scene.Token);
            var checklistMessage = await AssertErrorAsync(early, HttpStatusCode.BadRequest);
            Assert.Contains("Complete the exit checklist", checklistMessage);

            // Tick all five.
            for (var index = 0; index < 5; index++)
            {
                var tick = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/checklist",
                    new { index, done = true }, scene.Token);
                Assert.Equal(HttpStatusCode.OK, tick.StatusCode);
            }

            // Gate 2 — verdict missing.
            var noVerdict = await SendAsync(HttpMethod.Post, $"/api/separations/{separationId}/finalize", null, scene.Token);
            var verdictMessage = await AssertErrorAsync(noVerdict, HttpStatusCode.BadRequest);
            Assert.Contains("Save the exit verdict", verdictMessage);

            var verdict = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/verdict",
                new
                {
                    finalReason = "Relocation, mutually agreed",
                    settlement = new { direction = "owedToEmployee", amount = 800, note = "Unused leave" },
                    rehire = new { status = "Eligible" },
                }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, verdict.StatusCode);

            // Finalize — succeeds and archives.
            var response = await SendAsync(HttpMethod.Post, $"/api/separations/{separationId}/finalize", null, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains(scene.Employee.FullName, (await ReadAsync(response)).GetProperty("message").GetString());

            var detail = (await GetAsync($"/api/separations/{separationId}", scene.Token)).GetProperty("data");
            Assert.Equal("Completed", detail.GetProperty("status").GetString());
            Assert.Equal(100, detail.GetProperty("progress").GetInt32());

            // The employee is archived: Terminated, login severed, audited.
            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == scene.Employee.EmployeeId);
            Assert.Equal(EmployeeStatus.Terminated, employee.Status);
            var user = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == scene.Employee.UserId);
            Assert.False(user.IsActive);
            Assert.True(await Db.OffboardingCases.AnyAsync(c => c.Id == separationId && c.CompletedAt != null));
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Employee Offboarded" && a.UserId == scene.Hr.UserId));
            Assert.True(await Db.EmploymentHistories.AnyAsync(h =>
                h.EmployeeId == scene.Employee.EmployeeId && h.ChangeType == EmploymentChangeType.Offboard));
        }
    }
}
