using System.Net;
using System.Text.Json;
using DomainLayer.Models.EmployeeModule;
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
        public async Task Detail_LegacyCaseWithoutChecklist_GetsCanonicalExitSteps()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");

            // Cases seeded before the checklist existed have no exit steps at all.
            var legacy = new OffboardingCase
            {
                EmployeeId = scene.Employee.EmployeeId,
                LastWorkingDate = Days(10),
                Reason = "Family relocation",
                Status = "Notice Period",
                SeparationType = "Resignation",
                InitiatedBy = scene.Hr.UserId,
                InitiatedAt = DateTime.UtcNow,
            };
            Db.OffboardingCases.Add(legacy);
            await Db.SaveChangesAsync();

            var detail = (await GetAsync($"/api/separations/{legacy.Id}", scene.Token)).GetProperty("data");
            var checklist = detail.GetProperty("checklist").EnumerateArray().ToList();

            Assert.Equal(5, checklist.Count);
            Assert.Equal("Exit interview scheduled", checklist[0][0].GetString());
            Assert.Equal("Final settlement", checklist[4][0].GetString());
            Assert.All(checklist, entry => Assert.False(entry[1].GetBoolean()));
            Assert.Equal(0, detail.GetProperty("progress").GetInt32());
            Assert.Equal(5, await Db.OffboardingChecklistItems.CountAsync(i => i.OffboardingCaseId == legacy.Id));
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
        // Termination workflow — HR approval → exit interview → clearance
        // ------------------------------------------------------------------

        private async Task<int> RequestPendingTerminationAsync(Scene scene)
        {
            var employee = await scene.Builder.CreateEmployeeAsync(scene.Gym);
            var id = await RequestTerminationAsync(scene, employee, new
            {
                employeeId = employee.EmployeeId,
                lastDay = Iso(Days(20)),
                reason = "Attendance violations",
                notes = "Three unexcused absences.",
            });
            return id;
        }

        private async Task<JsonElement> DetailAsync(Scene scene, int id) =>
            (await GetAsync($"/api/separations/{id}", scene.Token)).GetProperty("data");

        [Fact]
        public async Task TerminationRequest_StartsPendingApproval_EmployeeUntouched()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await RequestPendingTerminationAsync(scene);

            var detail = await DetailAsync(scene, separationId);
            Assert.Equal("Pending", detail.GetProperty("approvalStatus").GetString());
            Assert.Equal("Requested", detail.GetProperty("status").GetString());
            Assert.Equal(JsonValueKind.Null, detail.GetProperty("exitInterviewStatus").ValueKind);

            var employeeId = detail.GetProperty("employeeId").GetInt32();
            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == employeeId);
            Assert.Equal(EmployeeStatus.Active, employee.Status);
        }

        [Fact]
        public async Task Approval_Approve_MovesToNoticePeriod_AndParksEmployee()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await RequestPendingTerminationAsync(scene);
            var employeeId = (await DetailAsync(scene, separationId)).GetProperty("employeeId").GetInt32();

            var response = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/approval",
                new { decision = "Approved", note = "Evidence reviewed." }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var detail = await DetailAsync(scene, separationId);
            Assert.Equal("Approved", detail.GetProperty("approvalStatus").GetString());
            Assert.Equal("Notice Period", detail.GetProperty("status").GetString());
            Assert.Equal("Evidence reviewed.", detail.GetProperty("approvalNote").GetString());

            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == employeeId);
            Assert.Equal(EmployeeStatus.NoticePeriod, employee.Status);
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Termination Request Approved" && a.EntityId == employeeId));
        }

        [Fact]
        public async Task Approval_Reject_CancelsCase_AndKeepsEmployeeActive()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await RequestPendingTerminationAsync(scene);
            var employeeId = (await DetailAsync(scene, separationId)).GetProperty("employeeId").GetInt32();

            var response = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/approval",
                new { decision = "Rejected", note = "Insufficient evidence." }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var detail = await DetailAsync(scene, separationId);
            Assert.Equal("Rejected", detail.GetProperty("approvalStatus").GetString());
            Assert.Equal("Cancelled", detail.GetProperty("status").GetString());

            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == employeeId);
            Assert.Equal(EmployeeStatus.Active, employee.Status);

            // A cancelled case cannot be scheduled.
            var schedule = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/exit-interview/schedule",
                new { scheduledAt = "2026-12-01T09:00:00Z" }, scene.Token);
            var message = await AssertErrorAsync(schedule, HttpStatusCode.BadRequest);
            Assert.Contains("cancelled", message);
        }

        [Fact]
        public async Task Interview_ScheduleThenNoShowThenReschedule_TracksStatus()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await RequestPendingTerminationAsync(scene);
            await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/approval",
                new { decision = "Approved" }, scene.Token);

            var scheduled = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/exit-interview/schedule",
                new { scheduledAt = "2026-12-01T14:30:00Z" }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, scheduled.StatusCode);
            var afterSchedule = await DetailAsync(scene, separationId);
            Assert.Equal("Scheduled", afterSchedule.GetProperty("exitInterviewStatus").GetString());
            Assert.Equal("Exit In Progress", afterSchedule.GetProperty("status").GetString());
            Assert.StartsWith("2026-12-01", afterSchedule.GetProperty("exitInterviewScheduledAt").GetString());

            var noShow = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/exit-interview/status",
                new { status = "No Show" }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, noShow.StatusCode);
            Assert.Equal("No Show", (await DetailAsync(scene, separationId)).GetProperty("exitInterviewStatus").GetString());

            var rescheduled = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/exit-interview/status",
                new { status = "Rescheduled", rescheduledAt = "2026-12-05T10:00:00Z" }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, rescheduled.StatusCode);
            var afterReschedule = await DetailAsync(scene, separationId);
            Assert.Equal("Rescheduled", afterReschedule.GetProperty("exitInterviewStatus").GetString());
            Assert.StartsWith("2026-12-05", afterReschedule.GetProperty("exitInterviewScheduledAt").GetString());
        }

        [Fact]
        public async Task Clearance_CompleteBeforeInterview_Returns400()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await RequestPendingTerminationAsync(scene);
            await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/approval",
                new { decision = "Approved" }, scene.Token);

            var response = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/clearance",
                new
                {
                    uniformReturned = true,
                    assetsReturned = true,
                    accessRevoked = true,
                    finalSettlementCompleted = true,
                    complete = true,
                }, scene.Token);
            var message = await AssertErrorAsync(response, HttpStatusCode.BadRequest);
            Assert.Contains("exit interview", message);
        }

        [Fact]
        public async Task ExitInterview_ExposesSeededQuestions_WhenNoneSavedYet()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await RequestPendingTerminationAsync(scene);
            await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/approval",
                new { decision = "Approved" }, scene.Token);

            var form = (await DetailAsync(scene, separationId)).GetProperty("exitInterview");
            var questions = form.GetProperty("questions").EnumerateArray().ToList();

            Assert.Equal(9, questions.Count);
            Assert.Equal("reason", questions[0].GetProperty("id").GetString());
            Assert.Equal("text", questions[0].GetProperty("kind").GetString());
            Assert.Contains(questions, q => q.GetProperty("kind").GetString() == "rating");
            Assert.Contains(questions, q => q.GetProperty("kind").GetString() == "checkbox");
        }

        [Fact]
        public async Task ExitInterview_CustomQuestions_RoundTrip_AndSyncLegacyFields()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await RequestPendingTerminationAsync(scene);
            await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/approval",
                new { decision = "Approved" }, scene.Token);

            var save = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/exit-interview", new
            {
                interviewer = "Mona Adel",
                interviewDate = "2026-12-01",
                rehireEligible = true,
                complete = false,
                questions = new object[]
                {
                    new { id = "reason", label = "Why are you leaving?", kind = "select", options = new[] { "Better pay", "Relocation" }, answer = "Better pay" },
                    new { id = "tools", label = "Which tools did you use?", kind = "multi", options = new[] { "CRM", "POS" }, answer = "CRM | POS" },
                    new { id = "recommend", label = "Would you recommend us?", kind = "checkbox", answer = "true" },
                    new { id = "custom", label = "Anything else?", kind = "text", answer = "Thanks" },
                },
            }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, save.StatusCode);

            var form = (await DetailAsync(scene, separationId)).GetProperty("exitInterview");
            var questions = form.GetProperty("questions").EnumerateArray().ToList();

            Assert.Equal(4, questions.Count);
            Assert.Equal("Why are you leaving?", questions[0].GetProperty("label").GetString());
            Assert.Equal("select", questions[0].GetProperty("kind").GetString());
            Assert.Equal(2, questions[0].GetProperty("options").GetArrayLength());
            Assert.Equal("Better pay", questions[0].GetProperty("answer").GetString());
            Assert.Equal("CRM | POS", questions[1].GetProperty("answer").GetString());
            Assert.Equal("true", questions[2].GetProperty("answer").GetString());

            // Known default ids still feed the legacy columns other features read.
            Assert.Equal("Better pay", form.GetProperty("reasonForLeaving").GetString());
            Assert.True(form.GetProperty("wouldRecommend").GetBoolean());
        }

        [Fact]
        public async Task ExitInterview_AdminCustomQuestionShapes_AreSanitized()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await RequestPendingTerminationAsync(scene);
            await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/approval",
                new { decision = "Approved" }, scene.Token);

            var save = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/exit-interview", new
            {
                interviewer = "Mona Adel",
                interviewDate = "2026-12-01",
                rehireEligible = true,
                complete = false,
                questions = new object[]
                {
                    // No options → degrades to text.
                    new { id = "empty-select", label = "Pick one", kind = "select", options = Array.Empty<string>(), answer = "x" },
                    // Rating outside 1–5 → clamped.
                    new { id = "job", label = "Job satisfaction", kind = "rating", answer = "9" },
                    // Blank label → dropped.
                    new { id = "blank", label = "   ", kind = "text", answer = "ignored" },
                },
            }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, save.StatusCode);

            var form = (await DetailAsync(scene, separationId)).GetProperty("exitInterview");
            var questions = form.GetProperty("questions").EnumerateArray().ToList();

            Assert.Equal(2, questions.Count);
            Assert.Equal("text", questions[0].GetProperty("kind").GetString());
            Assert.Equal("5", questions[1].GetProperty("answer").GetString());
            Assert.Equal(5, form.GetProperty("jobSatisfaction").GetInt32());
        }

        [Fact]
        public async Task ExitInterview_FormRequiresInterviewerAndRehireDecision()        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await RequestPendingTerminationAsync(scene);
            await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/approval",
                new { decision = "Approved" }, scene.Token);

            var incomplete = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/exit-interview",
                new { reasonForLeaving = "Attendance", complete = true }, scene.Token);
            var message = await AssertErrorAsync(incomplete, HttpStatusCode.BadRequest);
            Assert.Contains("Interviewer", message);
        }

        [Fact]
        public async Task Workflow_InterviewAndClearance_ArchivesEmployeeAsFormerEmployee()
        {
            var scene = await CreateSceneAsync("employees.view", "employees.offboard");
            var separationId = await RequestPendingTerminationAsync(scene);
            var employeeId = (await DetailAsync(scene, separationId)).GetProperty("employeeId").GetInt32();

            await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/approval",
                new { decision = "Approved" }, scene.Token);
            await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/exit-interview/schedule",
                new { scheduledAt = "2026-12-01T14:30:00Z" }, scene.Token);

            var interview = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/exit-interview",
                new
                {
                    interviewer = "Mona Adel",
                    interviewDate = "2026-12-01",
                    reasonForLeaving = "Attendance violations",
                    whatLikedMost = "Team culture",
                    whatToImprove = "Clearer expectations",
                    jobSatisfaction = 2,
                    managementRating = 2,
                    workEnvironmentRating = 3,
                    compensationRating = 2,
                    wouldRecommend = false,
                    notes = "Employee acknowledged the absences.",
                    rehireEligible = false,
                    rehireNote = "Two written warnings on file.",
                    blacklisted = true,
                    blacklistReason = "Documented HR hold.",
                    complete = true,
                }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, interview.StatusCode);

            var afterInterview = await DetailAsync(scene, separationId);
            Assert.Equal("Completed", afterInterview.GetProperty("exitInterviewStatus").GetString());
            var form = afterInterview.GetProperty("exitInterview");
            Assert.Equal("Mona Adel", form.GetProperty("interviewer").GetString());
            Assert.Equal(2, form.GetProperty("jobSatisfaction").GetInt32());
            Assert.False(form.GetProperty("rehireEligible").GetBoolean());
            Assert.True(afterInterview.GetProperty("blacklisted").GetBoolean());
            Assert.Equal("Documented HR hold.", afterInterview.GetProperty("blacklistReason").GetString());

            var clearance = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/clearance",
                new
                {
                    uniformReturned = true,
                    assetsReturned = true,
                    accessRevoked = true,
                    finalSettlementCompleted = true,
                    settlementDirection = "employeeOwes",
                    settlementAmount = 500,
                    notes = "Laptop returned.",
                    complete = true,
                }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, clearance.StatusCode);

            var detail = await DetailAsync(scene, separationId);
            Assert.Equal("Completed", detail.GetProperty("status").GetString());
            Assert.True(detail.GetProperty("clearance").GetProperty("completed").GetBoolean());
            Assert.Equal(100, detail.GetProperty("progress").GetInt32());
            Assert.NotEqual(JsonValueKind.Null, detail.GetProperty("terminationDate").ValueKind);

            // Archived automatically: the employee leaves the roster.
            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == employeeId);
            Assert.Equal(EmployeeStatus.Terminated, employee.Status);

            // And lands on the Former Employees tab (Completed + clearance).
            var list = await GetAsync("/api/separations?pageSize=100", scene.Token);
            var former = Assert.Single(ItemsOf(list), i =>
                i.GetProperty("id").GetInt32() == separationId);
            Assert.Equal("Completed", former.GetProperty("status").GetString());
            Assert.True(former.GetProperty("blacklisted").GetBoolean());

            // Completing again is refused.
            var again = await SendAsync(HttpMethod.Put, $"/api/separations/{separationId}/clearance",
                new
                {
                    uniformReturned = true,
                    assetsReturned = true,
                    accessRevoked = true,
                    finalSettlementCompleted = true,
                    complete = true,
                }, scene.Token);
            var message = await AssertErrorAsync(again, HttpStatusCode.BadRequest);
            Assert.Contains("already complete", message);
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
            // Mint a live refresh chain for the employee before the separation completes.
            await _fixture.LoginAsync(scene.Employee.Email, scene.Employee.Password);
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

            // Completed is a real termination: the employee is archived, the account
            // is deactivated, and the live refresh chain is revoked.
            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == scene.Employee.EmployeeId);
            Assert.Equal(EmployeeStatus.Terminated, employee.Status);
            var user = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == scene.Employee.UserId);
            Assert.False(user.IsActive);
            Assert.True(await Db.RefreshTokens.AnyAsync(t => t.UserId == scene.Employee.UserId));
            Assert.True(await Db.RefreshTokens.AsNoTracking()
                .Where(t => t.UserId == scene.Employee.UserId)
                .AllAsync(t => t.RevokedAtUtc != null));

            // Idempotent repeat (and it self-heals an already-completed case).
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
            // Mint a live refresh chain for the employee before finalize.
            await _fixture.LoginAsync(scene.Employee.Email, scene.Employee.Password);
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
            Assert.True(await Db.RefreshTokens.AnyAsync(t => t.UserId == scene.Employee.UserId));
            Assert.True(await Db.RefreshTokens.AsNoTracking()
                .Where(t => t.UserId == scene.Employee.UserId)
                .AllAsync(t => t.RevokedAtUtc != null));
            Assert.True(await Db.OffboardingCases.AnyAsync(c => c.Id == separationId && c.CompletedAt != null));
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Employee Offboarded" && a.UserId == scene.Hr.UserId));
            Assert.True(await Db.EmploymentHistories.AnyAsync(h =>
                h.EmployeeId == scene.Employee.EmployeeId && h.ChangeType == EmploymentChangeType.Offboard));
        }
    }
}
