using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.UserModule.Enums;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Evaluations + form builder (api-spec-from-ui.md §5.3/§5.4): the two-kind form
    /// CRUD, evaluator dispatch (idempotent + audited), the evaluator's assignment
    /// inbox, free-run/assigned submissions, cycle launching, the org-wide history
    /// reads with answers, the profile evaluations tab, performance cycles and goals.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class EvaluationControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public EvaluationControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        private async Task<(TestGym Gym, TestEmployee Employee)> SetupGymWithEmployeeAsync()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            return (gym, employee);
        }

        private static object FormBody(
            string name,
            string status = "Active",
            string position = "All",
            string gym = "All") => new
        {
            name,
            position,
            gym,
            status,
            questionList = new object[]
            {
                new { type = "text", text = "How is the team performing?", options = Array.Empty<string>() },
                new { type = "choose", text = "Overall rating?", options = new[] { "Good", "Great" } },
            },
        };

        private static object SingleQuestionFormBody(string name, string status = "Active", string position = "All") => new
        {
            name,
            position,
            gym = "All",
            status,
            questionList = new object[]
            {
                new { type = "checkbox", text = "Pick strengths", options = new[] { "Punctual", "Friendly", "Skilled" } },
            },
        };

        private async Task<JsonElement> GetJsonAsync(string url, string token)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, url, null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from {url} but got {(int)response.StatusCode}: {body}");
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        private async Task<HttpResponseMessage> PostAsync(string url, object body, string token)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Post, url, body, token);
            return await _fixture.Client.SendAsync(request);
        }

        private async Task<JsonElement> ReadElementAsync(HttpResponseMessage response)
        {
            var body = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        /// <summary>Creates a form through the API and returns its id.</summary>
        private async Task<int> CreateFormIdAsync(string token, object body)
        {
            var response = await PostAsync("/api/evaluation-forms", body, token);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await ReadElementAsync(response)).GetProperty("data").GetProperty("id").GetInt32();
        }

        // ------------------------------------------------------------------
        // §5.3 — evaluation form CRUD
        // ------------------------------------------------------------------

        [Fact]
        public async Task CreateForm_Returns201WithMappedQuestions()
        {
            var (gym, _) = await SetupGymWithEmployeeAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var response = await PostAsync("/api/evaluation-forms",
                FormBody("Team Performance 2031", position: "Trainer"), admin);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);

            var data = (await ReadElementAsync(response)).GetProperty("data");
            Assert.True(data.GetProperty("id").GetInt32() > 0);
            Assert.Equal("Team Performance 2031", data.GetProperty("name").GetString());
            Assert.Equal("Trainer", data.GetProperty("position").GetString());
            Assert.Equal("All", data.GetProperty("gym").GetString());
            Assert.Equal("Active", data.GetProperty("status").GetString());
            Assert.Equal(2, data.GetProperty("questions").GetInt32());
            Assert.NotEqual(JsonValueKind.Null, data.GetProperty("createdDate").ValueKind);
            Assert.Equal(JsonValueKind.Null, data.GetProperty("lastUsed").ValueKind);

            var questionList = data.GetProperty("questionList").EnumerateArray().ToList();
            Assert.Equal("text", questionList[0].GetProperty("type").GetString());
            Assert.Equal("choose", questionList[1].GetProperty("type").GetString());
            Assert.Equal(new[] { "Good", "Great" },
                questionList[1].GetProperty("options").EnumerateArray().Select(o => o.GetString()).ToArray());

            // A named gym resolves and echoes its name.
            var scoped = await PostAsync("/api/evaluation-forms",
                FormBody("Branch Coaching 2031", gym: gym.Name), admin);
            Assert.Equal(HttpStatusCode.Created, scoped.StatusCode);
            var scopedData = (await ReadElementAsync(scoped)).GetProperty("data");
            Assert.Equal(gym.Name, scopedData.GetProperty("gym").GetString());
        }

        [Fact]
        public async Task CreateForm_InvalidPayload_Returns400()
        {
            var admin = await _fixture.GetAdminTokenAsync();

            var noName = await PostAsync("/api/evaluation-forms", new
            {
                questionList = new object[] { new { type = "text", text = "Q1?", options = Array.Empty<string>() } },
            }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, noName.StatusCode);

            var noQuestions = await PostAsync("/api/evaluation-forms", new
            {
                name = "Empty",
                questionList = Array.Empty<object>(),
            }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, noQuestions.StatusCode);

            var oneOption = await PostAsync("/api/evaluation-forms", new
            {
                name = "Thin options",
                questionList = new object[] { new { type = "choose", text = "Pick?", options = new[] { "Only" } } },
            }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, oneOption.StatusCode);

            var badType = await PostAsync("/api/evaluation-forms", new
            {
                name = "Bad type",
                questionList = new object[] { new { type = "rating", text = "Q?", options = Array.Empty<string>() } },
            }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, badType.StatusCode);

            var badStatus = await PostAsync("/api/evaluation-forms", new
            {
                name = "Bad status",
                status = "Bogus",
                questionList = new object[] { new { type = "text", text = "Q?", options = Array.Empty<string>() } },
            }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, badStatus.StatusCode);
        }

        [Fact]
        public async Task Forms_WithoutPermission_Returns401()
        {
            var (gym, _) = await SetupGymWithEmployeeAsync();
            var builder = NewBuilder();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Gate checks 2031"));

            var getForms = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/evaluation-forms", null, token);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _fixture.Client.SendAsync(getForms)).StatusCode);

            var postForm = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/evaluation-forms",
                FormBody("Nope 2031"), token);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _fixture.Client.SendAsync(postForm)).StatusCode);

            var putForm = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/evaluation-forms/{formId}",
                FormBody("Nope 2031"), token);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _fixture.Client.SendAsync(putForm)).StatusCode);

            var deleteForm = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/evaluation-forms/{formId}", null, token);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _fixture.Client.SendAsync(deleteForm)).StatusCode);

            var getHiring = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/hiring-forms", null, token);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _fixture.Client.SendAsync(getHiring)).StatusCode);
        }

        [Fact]
        public async Task GetForms_FiltersByStatusAndPosition()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var activeId = await CreateFormIdAsync(admin, FormBody("Active Trainer 2031", status: "Active", position: "Trainer"));
            var inactiveId = await CreateFormIdAsync(admin, FormBody("Old Cleaner 2031", status: "Inactive", position: "Cleaner"));

            var inactive = await GetJsonAsync("/api/evaluation-forms?status=Inactive&pageSize=100", admin);
            var inactiveIds = inactive.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetInt32()).ToArray();
            Assert.Contains(inactiveId, inactiveIds);
            Assert.DoesNotContain(activeId, inactiveIds);

            var trainers = await GetJsonAsync("/api/evaluation-forms?position=Trainer&pageSize=100", admin);
            var trainerIds = trainers.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetInt32()).ToArray();
            Assert.Contains(activeId, trainerIds);
            Assert.DoesNotContain(inactiveId, trainerIds);

            var all = await GetJsonAsync("/api/evaluation-forms?pageSize=100", admin);
            Assert.True(all.GetProperty("total").GetInt32() >= 2);
            Assert.Contains(
                all.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("name").GetString() == "Active Trainer 2031");
        }

        [Fact]
        public async Task GetForm_ReturnsQuestionList_Unknown_Returns404()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Detail Form 2031"));

            var json = await GetJsonAsync($"/api/evaluation-forms/{formId}", admin);
            var data = json.GetProperty("data");
            Assert.Equal(formId, data.GetProperty("id").GetInt32());
            Assert.Equal(2, data.GetProperty("questionList").GetArrayLength());

            var missing = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/evaluation-forms/99999999", null, admin);
            Assert.Equal(HttpStatusCode.NotFound, (await _fixture.Client.SendAsync(missing)).StatusCode);
        }

        [Fact]
        public async Task UpdateForm_ReplacesQuestionsAndStatus()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Replaced Form 2031"));

            var request = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/evaluation-forms/{formId}",
                SingleQuestionFormBody("Replaced Form 2031", status: "Inactive"), admin);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var data = (await ReadElementAsync(response)).GetProperty("data");
            Assert.Equal(formId, data.GetProperty("id").GetInt32());
            Assert.Equal(1, data.GetProperty("questions").GetInt32());
            Assert.Equal("Inactive", data.GetProperty("status").GetString());
            var question = data.GetProperty("questionList").EnumerateArray().Single();
            Assert.Equal("checkbox", question.GetProperty("type").GetString());
            Assert.Equal(3, question.GetProperty("options").GetArrayLength());

            var inactive = await GetJsonAsync("/api/evaluation-forms?status=Inactive&pageSize=100", admin);
            Assert.Contains(
                inactive.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == formId);
        }

        [Fact]
        public async Task DeleteForm_WithoutResponses_Returns204()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Disposable Form 2031"));

            var request = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/evaluation-forms/{formId}", null, admin);
            Assert.Equal(HttpStatusCode.NoContent, (await _fixture.Client.SendAsync(request)).StatusCode);

            var get = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/evaluation-forms/{formId}", null, admin);
            Assert.Equal(HttpStatusCode.NotFound, (await _fixture.Client.SendAsync(get)).StatusCode);
        }

        [Fact]
        public async Task DeleteForm_WithResponses_Blocked400()
        {
            var (_, employee) = await SetupGymWithEmployeeAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Kept Form 2031"));

            var submit = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/evaluation-forms/{formId}/responses", new
            {
                employee = employee.FullName,
                formId,
                period = "Q3 2031",
                score = 80,
            }, admin);
            Assert.Equal(HttpStatusCode.Created, (await _fixture.Client.SendAsync(submit)).StatusCode);

            var delete = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/evaluation-forms/{formId}", null, admin);
            Assert.Equal(HttpStatusCode.BadRequest, (await _fixture.Client.SendAsync(delete)).StatusCode);

            var get = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/evaluation-forms/{formId}", null, admin);
            Assert.Equal(HttpStatusCode.OK, (await _fixture.Client.SendAsync(get)).StatusCode);
        }

        // ------------------------------------------------------------------
        // §5.3 — hiring forms
        // ------------------------------------------------------------------

        [Fact]
        public async Task HiringForm_CreateListUpdateDelete()
        {
            var admin = await _fixture.GetAdminTokenAsync();

            var create = await PostAsync("/api/hiring-forms", new
            {
                name = "Trainer Applications 2031",
                position = "Trainer",
                gym = "All",
                status = "Open",
                questionList = new object[]
                {
                    new { type = "text", text = "Why do you want to join?", options = Array.Empty<string>() },
                },
            }, admin);
            Assert.Equal(HttpStatusCode.Created, create.StatusCode);
            var created = (await ReadElementAsync(create)).GetProperty("data");
            var formId = created.GetProperty("id").GetInt32();
            Assert.Equal("Open", created.GetProperty("status").GetString());
            Assert.Equal("Trainer", created.GetProperty("position").GetString());
            Assert.Equal(1, created.GetProperty("questions").GetInt32());
            Assert.Equal(0, created.GetProperty("applicants").GetInt32());
            Assert.Equal("All", created.GetProperty("gym").GetString());

            var list = await GetJsonAsync("/api/hiring-forms?status=Open&pageSize=100", admin);
            Assert.Contains(
                list.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == formId);

            var update = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/hiring-forms/{formId}", new
            {
                name = "Trainer Applications 2031",
                position = "Trainer",
                gym = "All",
                status = "Closed",
                questionList = new object[]
                {
                    new { type = "text", text = "Why do you want to join?", options = Array.Empty<string>() },
                    new { type = "checkbox", text = "Available days", options = new[] { "Sat", "Sun" } },
                },
            }, admin);
            var updateResponse = await _fixture.Client.SendAsync(update);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var updated = (await ReadElementAsync(updateResponse)).GetProperty("data");
            Assert.Equal("Closed", updated.GetProperty("status").GetString());
            Assert.Equal(2, updated.GetProperty("questions").GetInt32());

            var delete = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/hiring-forms/{formId}", null, admin);
            Assert.Equal(HttpStatusCode.NoContent, (await _fixture.Client.SendAsync(delete)).StatusCode);

            var after = await GetJsonAsync("/api/hiring-forms?pageSize=100", admin);
            Assert.DoesNotContain(
                after.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == formId);
        }

        [Fact]
        public async Task HiringForm_DeleteWithApplications_BlockedAndValidation()
        {
            var admin = await _fixture.GetAdminTokenAsync();

            var noName = await PostAsync("/api/hiring-forms", new
            {
                questionList = new object[] { new { type = "text", text = "Q?", options = Array.Empty<string>() } },
            }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, noName.StatusCode);

            var badStatus = await PostAsync("/api/hiring-forms", new
            {
                name = "Bad status form",
                status = "Draft",
                questionList = new object[] { new { type = "text", text = "Q?", options = Array.Empty<string>() } },
            }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, badStatus.StatusCode);

            var create = await PostAsync("/api/hiring-forms", new
            {
                name = "Protected Hiring 2031",
                gym = "All",
                questionList = new object[] { new { type = "text", text = "Q?", options = Array.Empty<string>() } },
            }, admin);
            Assert.Equal(HttpStatusCode.Created, create.StatusCode);
            var formId = (await ReadElementAsync(create)).GetProperty("data").GetProperty("id").GetInt32();

            await NewBuilder().CreateHiringFormApplicationAsync(formId);

            var delete = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/hiring-forms/{formId}", null, admin);
            Assert.Equal(HttpStatusCode.BadRequest, (await _fixture.Client.SendAsync(delete)).StatusCode);

            var list = await GetJsonAsync("/api/hiring-forms?pageSize=100", admin);
            var row = list.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("id").GetInt32() == formId);
            Assert.Equal(1, row.GetProperty("applicants").GetInt32());
        }

        // ------------------------------------------------------------------
        // §5.4 — dispatch + inbox
        // ------------------------------------------------------------------

        [Fact]
        public async Task Dispatch_CreatesAssignmentsIsAuditedAndIdempotent()
        {
            var (gym, employee) = await SetupGymWithEmployeeAsync();
            var builder = NewBuilder();
            var evaluator = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(evaluator.UserId, "evaluations.manage");
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Dispatched Form 2031", gym: gym.Name));

            var request = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/evaluation-forms/{formId}/dispatch", new { }, admin);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var data = (await ReadElementAsync(response)).GetProperty("data");
            Assert.Equal(formId, data.GetProperty("formId").GetInt32());
            // Other suites may seed extra TopManagement evaluators (scope is unrestricted for
            // them) — assert our evaluator's card instead of exact global counts.
            Assert.True(data.GetProperty("routedEvaluators").GetInt32() >= 1);
            Assert.True(data.GetProperty("evaluationsAssigned").GetInt32() >= 1);

            var card = data.GetProperty("createdAssignments").EnumerateArray()
                .First(c => c.GetProperty("evaluatorEmail").GetString() == evaluator.Email);
            Assert.Equal("Dispatched Form 2031", card.GetProperty("formName").GetString());
            Assert.Equal("Assigned", card.GetProperty("status").GetString());
            Assert.Equal("admin", card.GetProperty("dispatchedBy").GetString());
            Assert.Equal(1, card.GetProperty("subjects").GetArrayLength());
            Assert.Contains(card.GetProperty("subjects").EnumerateArray(), s => s.GetString() == employee.FullName);
            Assert.Equal(0, card.GetProperty("completedSubjects").GetArrayLength());

            // Idempotent — no duplicate rows on a second dispatch.
            var again = await PostAsync($"/api/evaluation-forms/{formId}/dispatch", new { }, admin);
            var againData = (await ReadElementAsync(again)).GetProperty("data");
            Assert.Equal(0, againData.GetProperty("routedEvaluators").GetInt32());
            Assert.Equal(0, againData.GetProperty("evaluationsAssigned").GetInt32());

            // Audit trail for the §5.9 audit log.
            var audit = await GetJsonAsync("/api/audit-log?pageSize=10", admin);
            Assert.Contains(
                audit.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("action").GetString() == "Evaluation Dispatched");
        }

        [Fact]
        public async Task Dispatch_EdgeCases_Return400_404_401()
        {
            var (gym, _) = await SetupGymWithEmployeeAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var completedId = await CreateFormIdAsync(admin, FormBody("Completed Form 2031", status: "Completed"));

            var inactive = await PostAsync($"/api/evaluation-forms/{completedId}/dispatch", new { }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, inactive.StatusCode);

            var missing = await PostAsync("/api/evaluation-forms/99999999/dispatch", new { }, admin);
            Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);

            var builder = NewBuilder();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var forbidden = await PostAsync($"/api/evaluation-forms/{completedId}/dispatch", new { }, token);
            Assert.Equal(HttpStatusCode.Unauthorized, forbidden.StatusCode);
        }

        [Fact]
        public async Task Assignments_ReturnEvaluatorInbox()
        {
            var (gym, employee) = await SetupGymWithEmployeeAsync();
            var builder = NewBuilder();
            var evaluator = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(evaluator.UserId, "evaluations.manage");
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Inbox Form 2031", gym: gym.Name));
            Assert.Equal(HttpStatusCode.OK, (await PostAsync($"/api/evaluation-forms/{formId}/dispatch", new { }, admin)).StatusCode);

            var token = await _fixture.LoginAsync(evaluator.Email, evaluator.Password);
            var inbox = await GetJsonAsync("/api/evaluation-assignments", token);
            Assert.True(inbox.GetProperty("total").GetInt32() >= 1);

            var card = inbox.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("formId").GetInt32() == formId);
            Assert.Equal(evaluator.Email, card.GetProperty("evaluatorEmail").GetString());
            Assert.Equal("Inbox Form 2031", card.GetProperty("formName").GetString());
            Assert.Equal("Assigned", card.GetProperty("status").GetString());
            Assert.Equal("admin", card.GetProperty("dispatchedBy").GetString());
            Assert.NotEmpty(card.GetProperty("evaluatorName").GetString());
            Assert.Contains(card.GetProperty("subjects").EnumerateArray(), s => s.GetString() == employee.FullName);
            Assert.Equal(0, card.GetProperty("completedSubjects").GetArrayLength());

            var byForm = await GetJsonAsync($"/api/evaluation-assignments?formId={formId}", token);
            Assert.Contains(
                byForm.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == card.GetProperty("id").GetInt32());

            var completed = await GetJsonAsync($"/api/evaluation-assignments?formId={formId}&status=Completed", token);
            Assert.Equal(0, completed.GetProperty("total").GetInt32());
        }

        // ------------------------------------------------------------------
        // §5.4 — submissions
        // ------------------------------------------------------------------

        [Fact]
        public async Task Submit_FreeRun_CompletesAndStoresAnswers()
        {
            var (gym, employee) = await SetupGymWithEmployeeAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Free Run 2031", gym: gym.Name));

            var response = await PostAsync($"/api/evaluation-forms/{formId}/responses", new
            {
                employee = employee.FullName,
                formId,
                form = "Free Run 2031",
                period = "Q3 2031",
                score = 85,
                answers = new object[]
                {
                    new { question = "How is the team performing?", type = "text", answer = "Strong quarter" },
                    new { question = "Overall rating?", type = "choose", answer = "Great" },
                },
            }, admin);
            Assert.True(response.StatusCode == HttpStatusCode.Created,
                $"Expected 201: {await response.Content.ReadAsStringAsync()}");

            var payload = await ReadElementAsync(response);
            var data = payload.GetProperty("data");
            Assert.True(data.GetProperty("id").GetInt32() > 0);
            Assert.Equal(employee.FullName, data.GetProperty("employee").GetString());
            Assert.Equal("Free Run 2031", data.GetProperty("form").GetString());
            Assert.Equal(formId, data.GetProperty("formId").GetInt32());
            Assert.Equal("Q3 2031", data.GetProperty("period").GetString());
            Assert.Equal(85m, data.GetProperty("score").GetDecimal());
            Assert.Equal("Completed", data.GetProperty("status").GetString());
            Assert.Equal("Evaluation completed with standard scoring.", data.GetProperty("notes").GetString());
            Assert.Equal("admin", data.GetProperty("reviewedBy").GetString());
            Assert.NotEqual(JsonValueKind.Null, data.GetProperty("reviewedDate").ValueKind);
            Assert.Equal(gym.Name, data.GetProperty("gym").GetString());
            Assert.Equal(2, data.GetProperty("answers").GetArrayLength());
            Assert.Equal(JsonValueKind.Null, payload.GetProperty("assignment").ValueKind);

            // History reads: org-wide list, form-scoped convenience list, form lastUsed.
            var history = await GetJsonAsync($"/api/evaluation-responses?formId={formId}", admin);
            Assert.Equal(1, history.GetProperty("total").GetInt32());
            var row = history.GetProperty("items").EnumerateArray().Single();
            Assert.Equal("Strong quarter", row.GetProperty("answers").EnumerateArray().First()
                .GetProperty("answer").GetString());
            Assert.Equal("text", row.GetProperty("answers").EnumerateArray().First()
                .GetProperty("type").GetString());

            var formResponses = await GetJsonAsync($"/api/evaluation-forms/{formId}/responses", admin);
            Assert.Equal(1, formResponses.GetProperty("total").GetInt32());

            var form = await GetJsonAsync($"/api/evaluation-forms/{formId}", admin);
            Assert.NotEqual(JsonValueKind.Null, form.GetProperty("data").GetProperty("lastUsed").ValueKind);
            Assert.Equal(1, form.GetProperty("data").GetProperty("submissions").GetInt32());
        }

        [Fact]
        public async Task Submit_AssignedMode_FlipsAssignmentToCompleted()
        {
            var (gym, employee) = await SetupGymWithEmployeeAsync();
            var builder = NewBuilder();
            var evaluator = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(evaluator.UserId, "evaluations.manage");
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Assigned Run 2031", gym: gym.Name));
            Assert.Equal(HttpStatusCode.OK, (await PostAsync($"/api/evaluation-forms/{formId}/dispatch", new { }, admin)).StatusCode);

            var token = await _fixture.LoginAsync(evaluator.Email, evaluator.Password);
            var inbox = await GetJsonAsync($"/api/evaluation-assignments", token);
            var card = inbox.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("formId").GetInt32() == formId);
            var assignmentId = card.GetProperty("id").GetInt32();

            var response = await PostAsync($"/api/evaluation-forms/{formId}/responses", new
            {
                employee = employee.FullName,
                formId,
                form = "Assigned Run 2031",
                period = "Mid-Year Review 2031",
                score = 92,
                assignmentId,
                answers = new object[]
                {
                    new { question = "How is the team performing?", type = "text", answer = "Great" },
                },
            }, token);
            Assert.True(response.StatusCode == HttpStatusCode.Created,
                $"Expected 201: {await response.Content.ReadAsStringAsync()}");

            var payload = await ReadElementAsync(response);
            Assert.Equal("Completed", payload.GetProperty("data").GetProperty("status").GetString());
            var echo = payload.GetProperty("assignment");
            Assert.Equal(assignmentId, echo.GetProperty("id").GetInt32());
            Assert.Contains(echo.GetProperty("completedSubjects").EnumerateArray(),
                s => s.GetString() == employee.FullName);
            Assert.Equal("Completed", echo.GetProperty("status").GetString());

            var after = await GetJsonAsync($"/api/evaluation-assignments?formId={formId}&status=Completed", token);
            Assert.Contains(
                after.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == assignmentId);
        }

        [Fact]
        public async Task Submit_KeylessAssignmentHolder_IsAllowed()
        {
            var (gym, employee) = await SetupGymWithEmployeeAsync();
            var builder = NewBuilder();
            var holder = await builder.CreateUserAsync(UserType.HR, new[] { gym }); // no permission keys at all
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Holder Run 2031", gym: gym.Name));
            var rowId = await builder.CreateEvaluationAssignmentAsync(formId, employee.EmployeeId, holder.UserId, holder.UserId);

            var token = await _fixture.LoginAsync(holder.Email, holder.Password);
            var response = await PostAsync($"/api/evaluation-forms/{formId}/responses", new
            {
                employee = employee.FullName,
                formId,
                period = "Probation Review",
                score = 66,
                assignmentId = rowId,
            }, token);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);

            var payload = await ReadElementAsync(response);
            Assert.Equal("Completed", payload.GetProperty("data").GetProperty("status").GetString());
            var echo = payload.GetProperty("assignment");
            Assert.Equal(rowId, echo.GetProperty("id").GetInt32());
            Assert.Equal("Completed", echo.GetProperty("status").GetString());
        }

        [Fact]
        public async Task Submit_ForbiddenAndInvalid_ReturnErrors()
        {
            var (gym, employee) = await SetupGymWithEmployeeAsync();
            var builder = NewBuilder();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var hrToken = await _fixture.LoginAsync(hr.Email, hr.Password);
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Validation Run 2031", gym: gym.Name));

            var forbidden = await PostAsync($"/api/evaluation-forms/{formId}/responses", new
            {
                employee = employee.FullName,
                score = 70,
            }, hrToken);
            Assert.Equal(HttpStatusCode.Unauthorized, forbidden.StatusCode);

            var unknownEmployee = await PostAsync($"/api/evaluation-forms/{formId}/responses", new
            {
                employee = "No Such Person 2031",
                score = 70,
            }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, unknownEmployee.StatusCode);

            var badScore = await PostAsync($"/api/evaluation-forms/{formId}/responses", new
            {
                employee = employee.FullName,
                score = 150,
            }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, badScore.StatusCode);

            var unknownForm = await PostAsync("/api/evaluation-forms/99999999/responses", new
            {
                employee = employee.FullName,
                score = 70,
            }, admin);
            Assert.Equal(HttpStatusCode.NotFound, unknownForm.StatusCode);
        }

        // ------------------------------------------------------------------
        // §5.4 — launch cycle + history
        // ------------------------------------------------------------------

        [Fact]
        public async Task LaunchCycle_SeedsInProgressAndCycleChip()
        {
            var (gym, employee) = await SetupGymWithEmployeeAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Cycle Form 2031", gym: gym.Name));

            var response = await PostAsync($"/api/evaluation-forms/{formId}/launch-cycle",
                new { period = "Q3 2031" }, admin);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);

            var data = (await ReadElementAsync(response)).GetProperty("data");
            Assert.Equal(1, data.GetProperty("startedCount").GetInt32());
            Assert.Equal("In Progress", data.GetProperty("status").GetString());
            Assert.True(data.GetProperty("batchId").GetInt32() > 0);
            var batchId = data.GetProperty("batchId").GetInt32();

            // Relaunching the same label is idempotent.
            var again = await PostAsync($"/api/evaluation-forms/{formId}/launch-cycle",
                new { period = "Q3 2031" }, admin);
            var againData = (await ReadElementAsync(again)).GetProperty("data");
            Assert.Equal(0, againData.GetProperty("startedCount").GetInt32());
            Assert.Equal(batchId, againData.GetProperty("batchId").GetInt32());

            // The cycle chip + the seeded In Progress history row.
            var cycles = await GetJsonAsync("/api/performance-cycles", admin);
            var chip = cycles.GetProperty("items").EnumerateArray()
                .First(c => c.GetProperty("name").GetString() == "Q3 2031");
            Assert.Equal("In Progress", chip.GetProperty("status").GetString());

            var history = await GetJsonAsync("/api/evaluation-responses?period=Q3%202031&employeeId=" + employee.EmployeeId, admin);
            var row = history.GetProperty("items").EnumerateArray().Single();
            Assert.Equal("In Progress", row.GetProperty("status").GetString());
            Assert.Equal(JsonValueKind.Null, row.GetProperty("score").ValueKind);
        }

        [Fact]
        public async Task LaunchCycle_MissingPeriodOrNoPermission_ReturnErrors()
        {
            var (gym, _) = await SetupGymWithEmployeeAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Cycle Gates 2031", gym: gym.Name));

            var noPeriod = await PostAsync($"/api/evaluation-forms/{formId}/launch-cycle", new { }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, noPeriod.StatusCode);

            var builder = NewBuilder();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var forbidden = await PostAsync($"/api/evaluation-forms/{formId}/launch-cycle",
                new { period = "Q4 2031" }, token);
            Assert.Equal(HttpStatusCode.Unauthorized, forbidden.StatusCode);

            var cycles = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/performance-cycles", null, token);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _fixture.Client.SendAsync(cycles)).StatusCode);

            var responses = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/evaluation-responses", null, token);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _fixture.Client.SendAsync(responses)).StatusCode);
        }

        [Fact]
        public async Task Responses_FilterByEmployeeAndStatusWithPaging()
        {
            var (_, employee) = await SetupGymWithEmployeeAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Filtered History 2031"));

            var submit = await PostAsync($"/api/evaluation-forms/{formId}/responses", new
            {
                employee = employee.FullName,
                formId,
                period = "Q4 2031",
                score = 70,
                answers = new object[]
                {
                    new { question = "How is the team performing?", type = "text", answer = "Fine" },
                },
            }, admin);
            Assert.True(submit.StatusCode == HttpStatusCode.Created,
                $"Expected 201: {await submit.Content.ReadAsStringAsync()}");
            Assert.Equal(HttpStatusCode.Created,
                (await PostAsync($"/api/evaluation-forms/{formId}/launch-cycle", new { period = "Q1 2032" }, admin)).StatusCode);

            var completed = await GetJsonAsync("/api/evaluation-responses?status=Completed&pageSize=100", admin);
            Assert.Contains(
                completed.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("employee").GetString() == employee.FullName &&
                     i.GetProperty("status").GetString() == "Completed");

            var inProgress = await GetJsonAsync("/api/evaluation-responses?status=In%20Progress&pageSize=100", admin);
            Assert.Contains(
                inProgress.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("employee").GetString() == employee.FullName &&
                     i.GetProperty("status").GetString() == "In Progress" &&
                     i.GetProperty("score").ValueKind == JsonValueKind.Null);

            var byEmployee = await GetJsonAsync($"/api/evaluation-responses?employeeId={employee.EmployeeId}&pageSize=1", admin);
            Assert.Equal(2, byEmployee.GetProperty("total").GetInt32());
            Assert.Equal(2, byEmployee.GetProperty("totalPages").GetInt32());
            Assert.Equal(1, byEmployee.GetProperty("items").GetArrayLength());
        }

        [Fact]
        public async Task FormResponses_UnknownForm_Returns404()
        {
            var admin = await _fixture.GetAdminTokenAsync();

            var missing = _fixture.AuthorizedRequest(HttpMethod.Get,
                "/api/evaluation-forms/99999999/responses", null, admin);
            Assert.Equal(HttpStatusCode.NotFound, (await _fixture.Client.SendAsync(missing)).StatusCode);
        }

        [Fact]
        public async Task EmployeeEvaluations_ReturnProfileRowsWithResult()
        {
            var (gym, strong) = await SetupGymWithEmployeeAsync();
            var builder = NewBuilder();
            var weak = await builder.CreateEmployeeAsync(gym);
            var admin = await _fixture.GetAdminTokenAsync();
            var formId = await CreateFormIdAsync(admin, FormBody("Profile Tab 2031", gym: gym.Name));

            foreach (var (subject, score) in new[] { (strong, 75m), (weak, 50m) })
            {
                var response = await PostAsync($"/api/evaluation-forms/{formId}/responses", new
                {
                    employee = subject.FullName,
                    formId,
                    period = "Q3 2031",
                    score,
                }, admin);
                Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            }

            var strongRows = await GetJsonAsync($"/api/employees/{strong.EmployeeId}/evaluations", admin);
            var strongRow = strongRows.GetProperty("items").EnumerateArray().Single();
            Assert.Equal(strong.FullName, strongRow.GetProperty("employee").GetString());
            Assert.Equal("Q3 2031", strongRow.GetProperty("period").GetString());
            Assert.Equal(75m, strongRow.GetProperty("score").GetDecimal());
            Assert.Equal("Pass", strongRow.GetProperty("result").GetString());
            Assert.Equal("Completed", strongRow.GetProperty("status").GetString());
            Assert.Equal(gym.Name, strongRow.GetProperty("gym").GetString());
            Assert.Equal("Profile Tab 2031", strongRow.GetProperty("form").GetString());
            Assert.Equal(formId, strongRow.GetProperty("formId").GetInt32());
            Assert.NotEmpty(strongRow.GetProperty("position").GetString());

            var weakRows = await GetJsonAsync($"/api/employees/{weak.EmployeeId}/evaluations", admin);
            Assert.Equal("Below Target", weakRows.GetProperty("items").EnumerateArray().Single()
                .GetProperty("result").GetString());

            var (otherGym, _) = await SetupGymWithEmployeeAsync();
            var hr = await NewBuilder().CreateUserAsync(UserType.HR, new[] { otherGym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var forbidden = _fixture.AuthorizedRequest(HttpMethod.Get,
                $"/api/employees/{strong.EmployeeId}/evaluations", null, token);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _fixture.Client.SendAsync(forbidden)).StatusCode);
        }

        // ------------------------------------------------------------------
        // §5.4 — goals
        // ------------------------------------------------------------------

        [Fact]
        public async Task Goals_CreateAndList()
        {
            var (_, employee) = await SetupGymWithEmployeeAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var create = await PostAsync("/api/goals", new
            {
                employee = employee.FullName,
                title = "Ship onboarding revamp",
                due = "2031-12-15",
                owner = "Ops Lead",
            }, admin);
            Assert.Equal(HttpStatusCode.Created, create.StatusCode);

            var data = (await ReadElementAsync(create)).GetProperty("data");
            Assert.True(data.GetProperty("id").GetInt32() > 0);
            Assert.Equal(employee.FullName, data.GetProperty("employee").GetString());
            Assert.Equal("Ship onboarding revamp", data.GetProperty("title").GetString());
            Assert.Equal("On Track", data.GetProperty("status").GetString());
            Assert.Equal(0, data.GetProperty("progress").GetInt32());
            Assert.Equal("2031-12-15", data.GetProperty("due").GetString());
            Assert.Equal("Ops Lead", data.GetProperty("owner").GetString());

            // An unresolvable display name is kept verbatim (Goal.EmployeeName).
            var ghost = await PostAsync("/api/goals", new
            {
                employee = "Ghost Person 2031",
                title = "Mystery objective",
            }, admin);
            Assert.Equal(HttpStatusCode.Created, ghost.StatusCode);
            Assert.Equal("Ghost Person 2031",
                (await ReadElementAsync(ghost)).GetProperty("data").GetProperty("employee").GetString());

            var list = await GetJsonAsync("/api/goals?pageSize=100", admin);
            Assert.Contains(
                list.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("title").GetString() == "Ship onboarding revamp");
        }

        [Fact]
        public async Task Goals_ValidationAndPermission_Gates()
        {
            var (gym, _) = await SetupGymWithEmployeeAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var noTitle = await PostAsync("/api/goals", new { employee = "Someone", due = "2031-12-15" }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, noTitle.StatusCode);

            var badDue = await PostAsync("/api/goals", new { title = "T", due = "not-a-date" }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, badDue.StatusCode);

            var builder = NewBuilder();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var get = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/goals", null, token);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _fixture.Client.SendAsync(get)).StatusCode);

            var post = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/goals",
                new { title = "Nope" }, token);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _fixture.Client.SendAsync(post)).StatusCode);
        }
    }
}
