using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.UserModule.Enums;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Recruitment &amp; hiring module (api-spec-from-ui.md §5.1): vacancy CRUD +
    /// detail funnel, the vacancy-request queue (submit / approve / reject / reopen),
    /// the candidate pipeline (list filters, detail, block, stage moves), the hire
    /// wizard (employee + account + checklist + headcount decrement), interviews,
    /// follow-ups, the waiting list, and the New Comers onboarding checklist.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class RecruitmentControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public RecruitmentControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        private static string UniqueSuffix() => Guid.NewGuid().ToString("N")[..8];
        private static string UniqueEmail() => $"hire-{Guid.NewGuid():N}@test.local";

        private async Task<JsonElement> CreateVacancyViaApiAsync(string token, object body)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/vacancies", body, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            return json.GetProperty("data");
        }

        private async Task<JsonElement> HireViaApiAsync(string token, int applicationId, object body)
        {
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/applications/{applicationId}/hire", body, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            return json.GetProperty("data");
        }

        // ------------------------------------------------------------------
        // GET/POST /api/vacancies — vacancy directory
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetVacancies_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/vacancies");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetVacancies_HrWithoutPermission_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/vacancies", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task CreateVacancy_Returns201_WithContractFields()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var title = $"IT Coach {UniqueSuffix()}";

            var data = await CreateVacancyViaApiAsync(token, new
            {
                position = title,
                gym = gym.Name,
                headcountNeeded = 2,
                urgency = "High",
                source = "Job board",
                jobDescription = "Coaches members on the floor.",
                salary = 12500.75m,
                shift = "Morning"
            });

            Assert.True(data.GetProperty("id").GetInt32() > 0);
            Assert.Equal(title, data.GetProperty("position").GetString());
            Assert.Equal(gym.Name, data.GetProperty("gym").GetString());
            Assert.Equal(gym.GymId, data.GetProperty("gymId").GetInt32());
            Assert.Equal(2, data.GetProperty("headcount").GetInt32());
            Assert.Equal("High", data.GetProperty("urgency").GetString());
            Assert.Equal("Open", data.GetProperty("status").GetString());
            Assert.Equal("Job board", data.GetProperty("source").GetString());
            Assert.Equal("Morning", data.GetProperty("shift").GetString());
            Assert.Equal(12500.75m, data.GetProperty("salary").GetDecimal());
            Assert.Equal(0, data.GetProperty("candidates").GetInt32());
        }

        [Fact]
        public async Task CreateVacancy_UnknownGym_Returns400()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/vacancies", new
            {
                position = $"Nowhere Coach {UniqueSuffix()}",
                gym = "No Such Gym Ever"
            }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("gym", body.GetProperty("errorMessage").GetString(), StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task CreateVacancy_MissingPosition_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/vacancies", new
            {
                gym = gym.Name
            }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("Position", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task CreateVacancy_HrWithPermission_CreatesAtAssignedGymByName()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "recruitment.vacancies.manage");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var title = $"Floor Coach {UniqueSuffix()}";

            var data = await CreateVacancyViaApiAsync(token, new
            {
                position = title,
                gym = gym.Name,
                headcountNeeded = 1,
                urgency = "Medium"
            });

            Assert.Equal(gym.GymId, data.GetProperty("gymId").GetInt32());
            Assert.Equal("Open", data.GetProperty("status").GetString());
        }

        [Fact]
        public async Task GetVacancies_Hr_ReturnsOnlyAssignedGymVacancies()
        {
            var builder = NewBuilder();
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var vacancyA = await builder.CreateVacancyAsync(gymA, $"A Coach {UniqueSuffix()}");
            var vacancyB = await builder.CreateVacancyAsync(gymB, $"B Coach {UniqueSuffix()}");

            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gymA });
            await builder.GrantPermissionAsync(hr.UserId, "recruitment.view");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/vacancies?pageSize=100", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var items = body.GetProperty("items").EnumerateArray().ToList();
            Assert.All(items, i => Assert.Equal(gymA.GymId, i.GetProperty("gymId").GetInt32()));
            Assert.Contains(items, i => i.GetProperty("id").GetInt32() == vacancyA.VacancyId);
            Assert.DoesNotContain(items, i => i.GetProperty("id").GetInt32() == vacancyB.VacancyId);
        }

        [Fact]
        public async Task UpdateVacancy_UpdatesHeadcountStatusAndDescription()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var title = $"Update Coach {UniqueSuffix()}";
            var created = await CreateVacancyViaApiAsync(token, new
            {
                position = title,
                gym = gym.Name,
                headcountNeeded = 1
            });
            var vacancyId = created.GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/vacancies/{vacancyId}", new
            {
                headcountNeeded = 5,
                status = "Closed",
                urgency = "Low",
                jobDescription = "Updated description."
            }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = body.GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(5, data.GetProperty("headcount").GetInt32());
            Assert.Equal("Closed", data.GetProperty("status").GetString());
            Assert.Equal("Low", data.GetProperty("urgency").GetString());
            Assert.Equal("Updated description.", data.GetProperty("description").GetString());
        }

        [Fact]
        public async Task GetVacancy_ReturnsFunnelCandidatesAndEmployees()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var title = $"Funnel Coach {UniqueSuffix()}";
            var vacancy = await builder.CreateVacancyAsync(gym, title);
            var application = await builder.CreateApplicationAsync(vacancy);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/vacancies/{vacancy.VacancyId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(title, body.GetProperty("data").GetProperty("position").GetString());

            var funnel = body.GetProperty("funnel").EnumerateArray().ToList();
            Assert.Contains(funnel, f =>
                f.GetProperty("stage").GetString() == "Applied" &&
                f.GetProperty("count").GetInt32() >= 1);

            var candidates = body.GetProperty("candidates").EnumerateArray().ToList();
            Assert.Contains(candidates, c => c.GetProperty("name").GetString() == application.CandidateName);

            Assert.Equal(JsonValueKind.Array, body.GetProperty("employeesUnderPosition").ValueKind);
        }

        // ------------------------------------------------------------------
        // /api/vacancy-requests — requisition queue
        // ------------------------------------------------------------------

        [Fact]
        public async Task CreateVacancyRequest_HrWithoutPermission_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/vacancy-requests", new
            {
                position = $"Req Coach {UniqueSuffix()}",
                gym = gym.Name,
                reason = "Coverage gap"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task CreateVacancyRequest_Returns201Pending()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "recruitment.vacancy_request.create");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var title = $"Req Coach {UniqueSuffix()}";

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/vacancy-requests", new
            {
                position = title,
                gym = gym.Name,
                urgency = "High",
                reason = "Two members-requests a day and one trainer.",
                salary = 9000m,
                shift = "Evening",
                headcount = 3
            }, token);
            var response = await _fixture.Client.SendAsync(request);
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = json.GetProperty("data");

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.Equal("Pending", data.GetProperty("status").GetString());
            Assert.Equal(3, data.GetProperty("headcount").GetInt32());
            Assert.Equal("High", data.GetProperty("urgency").GetString());
            Assert.Equal(gym.Name, data.GetProperty("gym").GetString());
            Assert.Equal(title, data.GetProperty("position").GetString());
            Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("submittedBy").GetString()));
            Assert.Equal(JsonValueKind.Null, data.GetProperty("vacancyId").ValueKind);
        }

        private async Task<int> CreateRequestViaApiAsync(string token, string position, string gymName)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/vacancy-requests", new
            {
                position,
                gym = gymName,
                reason = "Integration-test requisition."
            }, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            return json.GetProperty("data").GetProperty("id").GetInt32();
        }

        [Fact]
        public async Task Decide_Approve_CreatesResultingVacancy()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var title = $"Approve Coach {UniqueSuffix()}";
            var requestId = await CreateRequestViaApiAsync(token, title, gym.Name);

            var decide = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/vacancy-requests/{requestId}/decide", new
            {
                decision = "Approved",
                comment = "Approved for Q4.",
                headcountNeeded = 3,
                jobDescription = "Now hiring."
            }, token);
            var decideResponse = await _fixture.Client.SendAsync(decide);
            var decideBody = await decideResponse.Content.ReadFromJsonAsync<JsonElement>();
            var data = decideBody.GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, decideResponse.StatusCode);
            Assert.Equal("Approved", data.GetProperty("status").GetString());
            Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("decidedBy").GetString()));
            var vacancyId = data.GetProperty("vacancyId").GetInt32();
            Assert.True(vacancyId > 0);

            var vacancyResponse = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/vacancies/{vacancyId}", null, token));
            var vacancyData = (await vacancyResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, vacancyResponse.StatusCode);
            Assert.Equal(3, vacancyData.GetProperty("headcount").GetInt32());
            Assert.Equal("Open", vacancyData.GetProperty("status").GetString());
            Assert.Equal("Vacancy Request", vacancyData.GetProperty("source").GetString());
            Assert.Equal("Now hiring.", vacancyData.GetProperty("description").GetString());
        }

        [Fact]
        public async Task Decide_Reject_SetsRejectedWithoutVacancy()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var requestId = await CreateRequestViaApiAsync(token, $"Reject Coach {UniqueSuffix()}", gym.Name);

            var decide = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/vacancy-requests/{requestId}/decide", new
            {
                decision = "Rejected",
                comment = "Budget frozen."
            }, token);
            var response = await _fixture.Client.SendAsync(decide);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = body.GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("Rejected", data.GetProperty("status").GetString());
            Assert.Equal(JsonValueKind.Null, data.GetProperty("vacancyId").ValueKind);
        }

        [Fact]
        public async Task Decide_Twice_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var requestId = await CreateRequestViaApiAsync(token, $"Twice Coach {UniqueSuffix()}", gym.Name);

            var first = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/vacancy-requests/{requestId}/decide",
                new { decision = "Approved" }, token));
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);

            var second = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/vacancy-requests/{requestId}/decide",
                new { decision = "Rejected" }, token));
            var body = await second.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
            Assert.Contains("already been decided", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Reopen_ApplicantlessVacancy_WithdrawsItAndReturnsPending()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var requestId = await CreateRequestViaApiAsync(token, $"Reopen Coach {UniqueSuffix()}", gym.Name);

            var decide = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/vacancy-requests/{requestId}/decide",
                new { decision = "Approved" }, token));
            var vacancyId = (await decide.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("data").GetProperty("vacancyId").GetInt32();

            var reopen = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/vacancy-requests/{requestId}/reopen", null, token));
            var body = await reopen.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, reopen.StatusCode);
            Assert.Equal("Pending", body.GetProperty("status").GetString());
            Assert.True(body.GetProperty("vacancyWithdrawn").GetBoolean());

            var vacancyResponse = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/vacancies/{vacancyId}", null, token));
            Assert.Equal(HttpStatusCode.NotFound, vacancyResponse.StatusCode);
        }

        [Fact]
        public async Task Reopen_VacancyWithApplicants_KeepsVacancy()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var title = $"Keep Coach {UniqueSuffix()}";
            var requestId = await CreateRequestViaApiAsync(token, title, gym.Name);

            var decide = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/vacancy-requests/{requestId}/decide",
                new { decision = "Approved" }, token));
            var vacancyId = (await decide.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("data").GetProperty("vacancyId").GetInt32();
            await builder.CreateApplicationAsync(new TestDataBuilder.TestVacancy(vacancyId, title));

            var reopen = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/vacancy-requests/{requestId}/reopen", null, token));
            var body = await reopen.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, reopen.StatusCode);
            Assert.False(body.GetProperty("vacancyWithdrawn").GetBoolean());

            var vacancyResponse = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/vacancies/{vacancyId}", null, token));
            Assert.Equal(HttpStatusCode.OK, vacancyResponse.StatusCode);
        }

        // ------------------------------------------------------------------
        // GET/PUT /api/candidates + /api/applications — pipeline
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetCandidates_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/candidates");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetCandidates_Search_ReturnsPipelineCardWithForm()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Pipe Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/candidates?searchTerm={Uri.EscapeDataString(application.CandidateName)}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var card = Assert.Single(items, i => i.GetProperty("id").GetInt32() == application.CandidateId);
            Assert.Equal(application.CandidateName, card.GetProperty("name").GetString());
            Assert.Equal("Applied", card.GetProperty("stage").GetString());
            Assert.Equal(application.ApplicationId, card.GetProperty("applicationId").GetInt32());

            var form = card.GetProperty("form");
            Assert.Contains("@test.local", form.GetProperty("email").GetString());
            Assert.Equal("Job board", form.GetProperty("source").GetString());
            Assert.Equal(2, form.GetProperty("skills").GetArrayLength());
            Assert.Equal("Face ID", form.GetProperty("skills")[0].GetString());
            Assert.Equal("Arabic", form.GetProperty("languages")[0].GetString());
        }

        [Fact]
        public async Task GetCandidates_StageFilter_Respected()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Stage Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();
            var term = Uri.EscapeDataString(application.CandidateName);

            var applied = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/candidates?stage=Applied&searchTerm={term}", null, token));
            var appliedBody = await applied.Content.ReadFromJsonAsync<JsonElement>();

            var hired = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/candidates?stage=Hired&searchTerm={term}", null, token));
            var hiredBody = await hired.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Contains(appliedBody.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == application.CandidateId);
            Assert.DoesNotContain(hiredBody.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == application.CandidateId);
        }

        [Fact]
        public async Task GetCandidate_ReturnsDetailWithFormBlocks()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Detail Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/candidates/{application.CandidateId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = body.GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(application.CandidateId, data.GetProperty("id").GetInt32());
            Assert.Equal(application.CandidateName, data.GetProperty("name").GetString());
            Assert.Equal("Applied", data.GetProperty("stage").GetString());
            Assert.Equal("Job board", data.GetProperty("form").GetProperty("source").GetString());
            Assert.Equal(JsonValueKind.Null, data.GetProperty("screen").ValueKind);
        }

        [Fact]
        public async Task SetBlock_TogglesBlockedWithReason()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Block Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();

            var block = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/candidates/{application.CandidateId}/block",
                new { blocked = true, blockReason = "No-show twice." }, token));
            var blockBody = await block.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, block.StatusCode);
            Assert.True(blockBody.GetProperty("blocked").GetBoolean());
            Assert.Equal("No-show twice.", blockBody.GetProperty("blockReason").GetString());

            var list = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get,
                $"/api/candidates?blocked=true&searchTerm={Uri.EscapeDataString(application.CandidateName)}",
                null, token));
            var listBody = await list.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(listBody.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == application.CandidateId);
        }

        [Fact]
        public async Task ChangeStage_MovesForwardAndSchedulesSecondInterviewRound()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Move Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();

            var screening = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/applications/{application.ApplicationId}/stage",
                new { stage = "Screening" }, token));
            var screeningBody = await screening.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, screening.StatusCode);
            Assert.Equal("Screening", screeningBody.GetProperty("stage").GetString());

            var second = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/applications/{application.ApplicationId}/stage",
                new { stage = "Second Interview" }, token));
            var secondBody = await second.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, second.StatusCode);
            Assert.Equal("Second Interview", secondBody.GetProperty("stage").GetString());
            var iv2 = secondBody.GetProperty("iv2");
            Assert.True(iv2.GetProperty("id").GetInt32() > 0);
            Assert.Equal("Scheduled", iv2.GetProperty("status").GetString());
            Assert.Equal("Panel", iv2.GetProperty("type").GetString());
        }

        [Fact]
        public async Task ChangeStage_ToHired_Returns400PointingAtHireWizard()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Hired Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/applications/{application.ApplicationId}/stage",
                new { stage = "Hired" }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("hire wizard", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task ChangeStage_UnknownStage_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Bogus Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/applications/{application.ApplicationId}/stage",
                new { stage = "Bogus Stage" }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // POST /api/applications/{id}/hire — the Hired transition
        // ------------------------------------------------------------------

        [Fact]
        public async Task Hire_CreatesEmployeeAccountChecklistAndClosesVacancy()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var title = $"Hire Coach {UniqueSuffix()}";
            var vacancy = await builder.CreateVacancyAsync(gym, title, headcount: 1);
            var application = await builder.CreateApplicationAsync(vacancy);
            var email = UniqueEmail();
            var startDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(10).ToString("yyyy-MM-dd");

            var data = await HireViaApiAsync(token, application.ApplicationId, new
            {
                gym = gym.Name,
                salary = 15000m,
                leaveDays = 21,
                startDate,
                level = "Mid",
                contractType = "Full-time",
                email,
                password = "HirePass!123"
            });

            var employeeId = data.GetProperty("employeeId").GetInt32();
            Assert.True(employeeId > 0);
            Assert.Equal(application.CandidateName, data.GetProperty("name").GetString());
            Assert.Equal(title, data.GetProperty("position").GetString());
            Assert.Equal(gym.Name, data.GetProperty("gym").GetString());
            Assert.Equal("Active", data.GetProperty("status").GetString());
            Assert.Equal(15000m, data.GetProperty("salary").GetDecimal());
            Assert.Equal(21, data.GetProperty("leaveDays").GetInt32());
            Assert.Equal(startDate, data.GetProperty("startDate").GetString());
            Assert.Equal(email, data.GetProperty("email").GetString());
            Assert.Equal(employeeId, data.GetProperty("newComerId").GetInt32());
            Assert.Equal(0, data.GetProperty("vacancyHeadcountRemaining").GetInt32());

            // The vacancy is closed once its headcount is consumed.
            var vacancyResponse = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/vacancies/{vacancy.VacancyId}", null, token));
            var vacancyData = (await vacancyResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.Equal("Closed", vacancyData.GetProperty("status").GetString());
            Assert.Equal(0, vacancyData.GetProperty("headcount").GetInt32());

            // The account works immediately (candidate → employee with login).
            var newToken = await _fixture.LoginAsync(email, "HirePass!123");
            Assert.False(string.IsNullOrWhiteSpace(newToken));

            // The candidate card flipped to Hired with a hiredDate.
            var candidateResponse = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/candidates/{application.CandidateId}", null, token));
            var candidateData = (await candidateResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.Equal("Hired", candidateData.GetProperty("stage").GetString());
            Assert.NotNull(candidateData.GetProperty("hiredDate").GetDateTime());
        }

        [Fact]
        public async Task Hire_DuplicateEmail_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Dupe Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var taken = await builder.CreateUserAsync(UserType.HR, new[] { gym });

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/applications/{application.ApplicationId}/hire",
                new { gym = gym.Name, email = taken.Email, password = "Whatever!123" }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("already in use", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Hire_UnknownRole_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Role Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/applications/{application.ApplicationId}/hire",
                new
                {
                    gym = gym.Name,
                    email = UniqueEmail(),
                    password = "Whatever!123",
                    role = "NoSuchRoleEver"
                }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("Unknown system role", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Hire_AlreadyHired_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Twice Coach {UniqueSuffix()}", headcount: 3);
            var application = await builder.CreateApplicationAsync(vacancy);

            await HireViaApiAsync(token, application.ApplicationId, new
            {
                gym = gym.Name,
                email = UniqueEmail(),
                password = "HirePass!123"
            });

            var second = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/applications/{application.ApplicationId}/hire",
                new { gym = gym.Name, email = UniqueEmail(), password = "HirePass!123" }, token));
            var body = await second.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
            Assert.Contains("already been hired", body.GetProperty("errorMessage").GetString());
        }

        // ------------------------------------------------------------------
        // GET /api/recruitment/follow-ups — staleness engine
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetFollowUps_ReturnsOnlyStaleApplications()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Follow Coach {UniqueSuffix()}");
            var stale = await builder.CreateApplicationAsync(vacancy);
            var fresh = await builder.CreateApplicationAsync(vacancy);
            await builder.MakeApplicationStaleAsync(stale.ApplicationId, days: 10);
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/recruitment/follow-ups?pageSize=100", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains(items, i => i.GetProperty("applicationId").GetInt32() == stale.ApplicationId);
            Assert.DoesNotContain(items, i => i.GetProperty("applicationId").GetInt32() == fresh.ApplicationId);
        }

        // ------------------------------------------------------------------
        // /api/interviews — calendar
        // ------------------------------------------------------------------

        private async Task<(int InterviewId, string Date)> CreateInterviewViaApiAsync(
            string token, int candidateId, string position, string? interviewer = null)
        {
            var date = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3).ToString("yyyy-MM-dd");
            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/interviews", new
            {
                candidateId,
                position,
                date,
                time = "14:00",
                type = "On-site",
                interviewer,
                room = "Room 3"
            }, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = json.GetProperty("data");
            return (data.GetProperty("id").GetInt32(), date);
        }

        [Fact]
        public async Task CreateInterview_Returns201ScheduledWithCalendarFields()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var title = $"Iv Coach {UniqueSuffix()}";
            var vacancy = await builder.CreateVacancyAsync(gym, title);
            var application = await builder.CreateApplicationAsync(vacancy);
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.GetAdminTokenAsync();

            var (interviewId, date) = await CreateInterviewViaApiAsync(
                token, application.CandidateId, title, hr.Email);

            var detail = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/interviews/{interviewId}", null, token));
            var data = (await detail.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
            Assert.Equal(application.CandidateId, data.GetProperty("candidateId").GetInt32());
            Assert.Equal(application.CandidateName, data.GetProperty("candidate").GetString());
            Assert.Equal(title, data.GetProperty("position").GetString());
            Assert.Equal(gym.Name, data.GetProperty("gym").GetString());
            Assert.Equal(date, data.GetProperty("date").GetString());
            Assert.Equal("14:00", data.GetProperty("time").GetString());
            Assert.Equal("On-site", data.GetProperty("type").GetString());
            Assert.Equal("Room 3", data.GetProperty("room").GetString());
            Assert.Equal("Scheduled", data.GetProperty("status").GetString());
            Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("interviewer").GetString()));
        }

        [Fact]
        public async Task GetInterviews_MonthFilter_ContainsInterview()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Month Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();

            var (interviewId, date) = await CreateInterviewViaApiAsync(token, application.CandidateId, vacancy.Title);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/interviews?month={date[..7]}&pageSize=100", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains(body.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == interviewId);
        }

        [Fact]
        public async Task CompleteInterview_SetsCompleted()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Done Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();
            var (interviewId, _) = await CreateInterviewViaApiAsync(token, application.CandidateId, vacancy.Title);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/interviews/{interviewId}/complete", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("Completed", body.GetProperty("data").GetProperty("status").GetString());
        }

        [Fact]
        public async Task SendReminder_ReturnsMessage()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Remind Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();
            var (interviewId, _) = await CreateInterviewViaApiAsync(token, application.CandidateId, vacancy.Title);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/interviews/{interviewId}/reminder", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("Reminder sent.", body.GetProperty("message").GetString());
        }

        [Fact]
        public async Task CreateInterview_UnknownCandidate_Returns400()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/interviews", new
            {
                candidateId = 99_999_999,
                date = "2026-12-01",
                time = "10:00"
            }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("Candidate", body.GetProperty("errorMessage").GetString());
        }

        // ------------------------------------------------------------------
        // /api/recruitment/waiting-list — parked candidates
        // ------------------------------------------------------------------

        [Fact]
        public async Task WaitingList_ReturnsEntrySkillsNoteAndMatches()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var title = $"Wait Coach {UniqueSuffix()}";
            var vacancy = await builder.CreateVacancyAsync(gym, title);
            var second = await builder.CreateVacancyAsync(gym, title);
            var waiting = await builder.CreateWaitingApplicationAsync(vacancy, note: "Strong English, available immediately.");
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/recruitment/waiting-list?pageSize=100", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var card = Assert.Single(items, i => i.GetProperty("id").GetInt32() == waiting.ApplicationId);
            Assert.Equal(waiting.CandidateName, card.GetProperty("name").GetString());
            Assert.Equal(title, card.GetProperty("position").GetString());
            Assert.Equal("Strong English, available immediately.", card.GetProperty("note").GetString());
            Assert.Equal("Job board", card.GetProperty("source").GetString());

            var skills = card.GetProperty("skills").EnumerateArray().Select(s => s.GetString()).ToList();
            Assert.Contains("Face ID", skills);

            var matches = card.GetProperty("matchingVacancies").EnumerateArray()
                .Select(m => m.GetProperty("id").GetInt32()).ToList();
            Assert.Contains(vacancy.VacancyId, matches);
            Assert.Contains(second.VacancyId, matches);
        }

        [Fact]
        public async Task AssignWaitingCandidate_CreatesEmployeeAndRemovesEntry()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Assign Coach {UniqueSuffix()}");
            var waiting = await builder.CreateWaitingApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/recruitment/waiting-list/{waiting.ApplicationId}/assign",
                new
                {
                    gym = gym.Name,
                    salary = 11000m,
                    level = "Junior",
                    startDate = "2026-11-01",
                    email = UniqueEmail(),
                    password = "WaitList!123"
                }, token);
            var response = await _fixture.Client.SendAsync(request);
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = json.GetProperty("data");

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.True(data.GetProperty("employeeId").GetInt32() > 0);
            Assert.Equal(data.GetProperty("employeeId").GetInt32(), data.GetProperty("newComerId").GetInt32());
            Assert.Equal(waiting.CandidateName, data.GetProperty("name").GetString());
            Assert.True(data.GetProperty("waitingListRemoved").GetBoolean());

            var list = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, "/api/recruitment/waiting-list?pageSize=100", null, token));
            var listBody = await list.Content.ReadFromJsonAsync<JsonElement>();
            Assert.DoesNotContain(listBody.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == waiting.ApplicationId);
        }

        [Fact]
        public async Task RemoveWaitingEntry_Returns204AndGone()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Del Coach {UniqueSuffix()}");
            var waiting = await builder.CreateWaitingApplicationAsync(vacancy);
            var token = await _fixture.GetAdminTokenAsync();

            var delete = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Delete, $"/api/recruitment/waiting-list/{waiting.ApplicationId}", null, token));
            Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

            var list = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, "/api/recruitment/waiting-list?pageSize=100", null, token));
            var listBody = await list.Content.ReadFromJsonAsync<JsonElement>();
            Assert.DoesNotContain(listBody.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == waiting.ApplicationId);
        }

        // ------------------------------------------------------------------
        // /api/employees/new-comers + onboarding checklist
        // ------------------------------------------------------------------

        [Fact]
        public async Task NewComers_ContainsHiredEmployeeWithFiveItemChecklist()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"New Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);

            var hire = await HireViaApiAsync(token, application.ApplicationId, new
            {
                gym = gym.Name,
                email = UniqueEmail(),
                password = "HirePass!123"
            });
            var employeeId = hire.GetProperty("employeeId").GetInt32();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees/new-comers", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var card = Assert.Single(body.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == employeeId);
            Assert.Equal(application.CandidateName, card.GetProperty("name").GetString());
            Assert.Equal(5, card.GetProperty("checklist").GetArrayLength());
            Assert.Equal(0, card.GetProperty("progress").GetInt32());
            Assert.Equal("ID & contract signed", card.GetProperty("checklist")[0][0].GetString());
            Assert.False(card.GetProperty("checklist")[0][1].GetBoolean());
        }

        [Fact]
        public async Task OnboardingChecklist_SingleToggle_UpdatesProgress()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Toggle Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var hire = await HireViaApiAsync(token, application.ApplicationId, new
            {
                gym = gym.Name,
                email = UniqueEmail(),
                password = "HirePass!123"
            });
            var employeeId = hire.GetProperty("employeeId").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/employees/{employeeId}/onboarding-checklist",
                new { item = "ID & contract signed", done = true }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = body.GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(employeeId, data.GetProperty("id").GetInt32());
            Assert.Equal(20, data.GetProperty("progress").GetInt32());
            var checklist = data.GetProperty("checklist");
            Assert.Equal(5, checklist.GetArrayLength());
            Assert.Equal("ID & contract signed", checklist[0][0].GetString());
            Assert.True(checklist[0][1].GetBoolean());
            Assert.False(checklist[1][1].GetBoolean());
        }

        [Fact]
        public async Task OnboardingChecklist_BatchReplace_UpdatesProgress()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Batch Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var hire = await HireViaApiAsync(token, application.ApplicationId, new
            {
                gym = gym.Name,
                email = UniqueEmail(),
                password = "HirePass!123"
            });
            var employeeId = hire.GetProperty("employeeId").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/employees/{employeeId}/onboarding-checklist",
                new
                {
                    checklist = new object[]
                    {
                        new object[] { "ID & contract signed", true },
                        new object[] { "Uniform issued", true }
                    }
                }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = body.GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(40, data.GetProperty("progress").GetInt32());
            Assert.True(data.GetProperty("checklist")[0][1].GetBoolean());
            Assert.True(data.GetProperty("checklist")[1][1].GetBoolean());
        }

        [Fact]
        public async Task OnboardingChecklist_UnknownItem_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"BadItem Coach {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);
            var hire = await HireViaApiAsync(token, application.ApplicationId, new
            {
                gym = gym.Name,
                email = UniqueEmail(),
                password = "HirePass!123"
            });
            var employeeId = hire.GetProperty("employeeId").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/employees/{employeeId}/onboarding-checklist",
                new { item = "Mystery item nobody added", done = true }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("Unknown checklist item", body.GetProperty("errorMessage").GetString());
        }
    }
}
