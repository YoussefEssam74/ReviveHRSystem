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
    /// Public hiring forms + applications (api-spec-from-ui.md §5.2): the anonymous
    /// catalogue/detail, form submissions (careers fields, validation, blocked gate,
    /// rate-limit exempt), the authenticated applicant pane (filters, detail, reject)
    /// and the Add-to-Pipeline conversion that creates a vacancy-less candidate.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class HiringFormApplicationsControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public HiringFormApplicationsControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        private static string UniqueSuffix() => Guid.NewGuid().ToString("N")[..8];

        private async Task<JsonElement> GetAnonymousJsonAsync(string url)
        {
            var response = await _fixture.Client.GetAsync(url);
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from {url} but got {(int)response.StatusCode}: {body}");
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        private async Task<JsonElement> GetJsonAsync(string url, string token)
        {
            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(HttpMethod.Get, url, null, token));
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from {url} but got {(int)response.StatusCode}: {body}");
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        private async Task<HttpResponseMessage> PostAsync(string url, object body, string? token = null)
            => token is null
                ? await _fixture.Client.PostAsJsonAsync(url, body)
                : await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(HttpMethod.Post, url, body, token));

        private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body, string token)
            => await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(method, url, body, token));

        private async Task<JsonElement> ReadElementAsync(HttpResponseMessage response)
        {
            var body = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        /// <summary>Asserts an error status and returns the envelope's errorMessage.</summary>
        private async Task<string> AssertErrorAsync(HttpResponseMessage response, HttpStatusCode expected)
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == expected,
                $"Expected {(int)expected} but got {(int)response.StatusCode}: {body}");
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.GetProperty("errorMessage").GetString() ?? string.Empty;
        }

        private static object HiringFormBody(string name, string position, string gym = "All", string status = "Open") => new
        {
            name,
            position,
            gym,
            status,
            questionList = new object[]
            {
                new { type = "text", text = "Why do you want to join?", options = Array.Empty<string>() },
            },
        };

        private async Task<int> CreateHiringFormIdAsync(string token, object body)
        {
            var response = await PostAsync("/api/hiring-forms", body, token);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await ReadElementAsync(response)).GetProperty("data").GetProperty("id").GetInt32();
        }

        private async Task<HttpResponseMessage> SubmitApplicationAsync(object body)
            => await PostAsync("/api/applications", body);

        // ------------------------------------------------------------------
        // Public catalogue (§5.2)
        // ------------------------------------------------------------------

        [Fact]
        public async Task PublicList_ReturnsOpenFormsOnlyWithQuestionList()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var openPosition = $"Careers Scout {UniqueSuffix()}";
            var closedPosition = $"Retired Scout {UniqueSuffix()}";
            var openId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Open Roles {UniqueSuffix()}", openPosition));
            var closedId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Closed Roles {UniqueSuffix()}", closedPosition, status: "Closed"));

            // Anonymous: only the open form, with the public item shape.
            var open = await GetAnonymousJsonAsync($"/api/hiring-forms?position={Uri.EscapeDataString(openPosition)}");
            var openItem = open.GetProperty("items").EnumerateArray()
                .Single(i => i.GetProperty("id").GetInt32() == openId);
            Assert.Equal("Open", openItem.GetProperty("status").GetString());
            Assert.Equal("Why do you want to join?", openItem.GetProperty("questionList").EnumerateArray()
                .First().GetProperty("text").GetString());
            Assert.NotEqual(JsonValueKind.Null, openItem.GetProperty("createdDate").ValueKind);

            // Closed forms never reach the public view — and status=Closed cannot opt in.
            var closed = await GetAnonymousJsonAsync($"/api/hiring-forms?position={Uri.EscapeDataString(closedPosition)}");
            Assert.Equal(0, closed.GetProperty("total").GetInt32());
            var optedIn = await GetAnonymousJsonAsync(
                $"/api/hiring-forms?position={Uri.EscapeDataString(closedPosition)}&status=Closed");
            Assert.Equal(0, optedIn.GetProperty("total").GetInt32());

            // The admin side still lists the closed form.
            var adminList = await GetJsonAsync($"/api/hiring-forms?position={Uri.EscapeDataString(closedPosition)}", admin);
            Assert.Contains(
                adminList.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == closedId);
        }

        [Fact]
        public async Task PublicList_FiltersByGymNameAndPosition()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var builder = NewBuilder();
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var posA = $"Branch Host {UniqueSuffix()}";
            var posB = $"Branch Clerk {UniqueSuffix()}";
            var posAll = $"Branch Float {UniqueSuffix()}";

            var atA = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Branch A Form {UniqueSuffix()}", posA, gym: gymA.Name));
            var atB = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Branch B Form {UniqueSuffix()}", posB, gym: gymB.Name));
            var atAll = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Branch All Form {UniqueSuffix()}", posAll));

            var byGym = await GetAnonymousJsonAsync($"/api/hiring-forms?gym={Uri.EscapeDataString(gymA.Name)}");
            var byGymIds = byGym.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetInt32()).ToList();
            Assert.Contains(atA, byGymIds);      // matching branch
            Assert.DoesNotContain(atB, byGymIds); // other branch is hidden

            var unknown = await GetAnonymousJsonAsync($"/api/hiring-forms?gym=Nowhere-{UniqueSuffix()}");
            Assert.Equal(0, unknown.GetProperty("total").GetInt32());

            var byPosition = await GetAnonymousJsonAsync($"/api/hiring-forms?position={Uri.EscapeDataString(posAll)}");
            Assert.Contains(
                byPosition.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == atAll);
        }

        [Fact]
        public async Task PublicDetail_ReturnsOpenAndHidesClosed()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var openId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Public Detail {UniqueSuffix()}", $"Detail Role {UniqueSuffix()}"));
            var closedId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Private Detail {UniqueSuffix()}", $"Detail Dead {UniqueSuffix()}", status: "Closed"));

            var detail = await GetAnonymousJsonAsync($"/api/hiring-forms/{openId}");
            var data = detail.GetProperty("data");
            Assert.Equal("Open", data.GetProperty("status").GetString());
            Assert.Single(data.GetProperty("questionList").EnumerateArray());

            var closedResponse = await _fixture.Client.GetAsync($"/api/hiring-forms/{closedId}");
            await AssertErrorAsync(closedResponse, HttpStatusCode.NotFound);

            var missingResponse = await _fixture.Client.GetAsync("/api/hiring-forms/2147483000");
            await AssertErrorAsync(missingResponse, HttpStatusCode.NotFound);
        }

        // ------------------------------------------------------------------
        // Admin side of the same routes (permission gates)
        // ------------------------------------------------------------------

        [Fact]
        public async Task AuthenticatedRoutes_RequirePermissions()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var builder = NewBuilder();
            var formId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Gate Form {UniqueSuffix()}", $"Gate Role {UniqueSuffix()}"));
            var applicationId = await SubmitAndGetIdAsync(formId, $"Gate Applicant {UniqueSuffix()}");

            var gateGym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateUserAsync(UserType.Employee, new[] { gateGym });
            var token = await _fixture.LoginAsync(employee.Email, employee.Password);

            var list = await SendAsync(HttpMethod.Get, "/api/hiring-forms", null, token);
            await AssertErrorAsync(list, HttpStatusCode.Unauthorized);

            var detail = await SendAsync(HttpMethod.Get, $"/api/hiring-forms/{formId}", null, token);
            await AssertErrorAsync(detail, HttpStatusCode.Unauthorized);

            var applicants = await SendAsync(HttpMethod.Get, "/api/applications", null, token);
            await AssertErrorAsync(applicants, HttpStatusCode.Unauthorized);

            var applicantDetail = await SendAsync(HttpMethod.Get, $"/api/applications/{applicationId}", null, token);
            await AssertErrorAsync(applicantDetail, HttpStatusCode.Unauthorized);

            var reject = await SendAsync(HttpMethod.Put, $"/api/applications/{applicationId}/reject",
                new { comment = "nope" }, token);
            await AssertErrorAsync(reject, HttpStatusCode.Unauthorized);

            var convert = await SendAsync(HttpMethod.Post, "/api/candidates", new { applicationId }, token);
            await AssertErrorAsync(convert, HttpStatusCode.Unauthorized);
        }

        // ------------------------------------------------------------------
        // Submissions (public POST /api/applications)
        // ------------------------------------------------------------------

        [Fact]
        public async Task Submit_CreatesApplicantAnswersAndTouchesForm()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var suffix = UniqueSuffix();
            var position = $"Barista Lead {suffix}";
            var formName = $"Coffee Roles {suffix}";
            var gym = await NewBuilder().CreateGymWithStationAsync();
            var formId = await CreateHiringFormIdAsync(admin,
                HiringFormBody(formName, position, gym: gym.Name));

            var submit = await SubmitApplicationAsync(new
            {
                formId,
                name = $"Amira Test {suffix}",
                email = $"amira-{suffix}@test.local",
                phone = "+15550001111",
                gym = gym.Name,
                position,
                answers = new object[]
                {
                    new { question = "Why do you want to join?", type = "text", answer = "Because coffee." },
                    new { question = "Pick shifts", type = "checkbox", answer = new[] { "Morning", "Night" } },
                },
            });
            Assert.Equal(HttpStatusCode.Created, submit.StatusCode);
            Assert.Equal("Application submitted.", (await ReadElementAsync(submit)).GetProperty("message").GetString());

            var list = await GetJsonAsync($"/api/applications?formId={formId}", admin);
            Assert.Equal(1, list.GetProperty("total").GetInt32());
            var item = list.GetProperty("items").EnumerateArray().Single();
            Assert.Equal("New", item.GetProperty("status").GetString());
            Assert.Equal($"Amira Test {suffix}", item.GetProperty("name").GetString());
            Assert.Equal(formName, item.GetProperty("formName").GetString());
            Assert.Equal(gym.Name, item.GetProperty("gym").GetString());
            Assert.NotEqual(JsonValueKind.Null, item.GetProperty("appliedDate").ValueKind);

            var answers = item.GetProperty("answers").EnumerateArray().ToList();
            Assert.Equal(2, answers.Count);
            Assert.Equal("Because coffee.", answers[0].GetProperty("answer").GetString());
            Assert.Equal(JsonValueKind.Array, answers[1].GetProperty("answer").ValueKind);

            // lastUsed stamps on the form card after the first submission.
            var formCard = await GetJsonAsync($"/api/hiring-forms?position={Uri.EscapeDataString(position)}", admin);
            Assert.NotEqual(JsonValueKind.Null,
                formCard.GetProperty("items").EnumerateArray().Single().GetProperty("lastUsed").ValueKind);
        }

        [Fact]
        public async Task Submit_ValidationAndClosedFormErrors()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var closedId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Closed Subs {UniqueSuffix()}", $"Dead Role {UniqueSuffix()}", status: "Closed"));
            var openId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Open Subs {UniqueSuffix()}", $"Live Role {UniqueSuffix()}"));
            var baseBody = new { name = "Someone", email = "someone@test.local", phone = "+1" };

            var noForm = await SubmitApplicationAsync(baseBody);
            Assert.Contains("A formId is required", await AssertErrorAsync(noForm, HttpStatusCode.BadRequest));

            var unknownForm = await SubmitApplicationAsync(new { formId = 2147483000, name = "X", email = "x@test.local" });
            await AssertErrorAsync(unknownForm, HttpStatusCode.NotFound);

            var closedForm = await SubmitApplicationAsync(new { formId = closedId, name = "X", email = "x2@test.local" });
            Assert.Contains("no longer accepting",
                await AssertErrorAsync(closedForm, HttpStatusCode.BadRequest));

            var noName = await SubmitApplicationAsync(new { formId = openId, email = "n1@test.local" });
            Assert.Contains("Name is required", await AssertErrorAsync(noName, HttpStatusCode.BadRequest));

            var noEmail = await SubmitApplicationAsync(new { formId = openId, name = "N" });
            Assert.Contains("Email is required", await AssertErrorAsync(noEmail, HttpStatusCode.BadRequest));

            var badEmail = await SubmitApplicationAsync(new { formId = openId, name = "N", email = "not-an-email" });
            Assert.Contains("valid email", await AssertErrorAsync(badEmail, HttpStatusCode.BadRequest));
        }

        [Fact]
        public async Task Submit_BlockedCandidateEmailRejected()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var vacancy = await builder.CreateVacancyAsync(gym, $"Block Role {UniqueSuffix()}");
            var application = await builder.CreateApplicationAsync(vacancy);

            var candidate = await GetJsonAsync($"/api/candidates/{application.CandidateId}", admin);
            var blockedEmail = candidate.GetProperty("data").GetProperty("form").GetProperty("email").GetString()!;

            var block = await SendAsync(HttpMethod.Put, $"/api/candidates/{application.CandidateId}/block",
                new { blocked = true, blockReason = "Ghost applicant." }, admin);
            Assert.Equal(HttpStatusCode.OK, block.StatusCode);

            var formId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Blocked Gate {UniqueSuffix()}", $"Gate Role {UniqueSuffix()}"));
            var submit = await SubmitApplicationAsync(new
            {
                formId,
                name = "Blocked Person",
                email = blockedEmail,
                phone = "+1",
            });
            Assert.Contains("blocked", await AssertErrorAsync(submit, HttpStatusCode.BadRequest));
        }

        [Fact]
        public async Task Submit_CareersFieldsWinGymPrefAndStorePosition()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var suffix = UniqueSuffix();
            var position = $"Stack Lead {suffix}";
            var formId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Platform Roles {suffix}", $"Platform Role {suffix}"));

            var submit = await SubmitApplicationAsync(new
            {
                formId,
                name = $"Careers Applicant {suffix}",
                email = $"careers-{suffix}@test.local",
                phone = "+15550002222",
                gym = "Ignored Branch",
                gymPref = "Head Office",
                position,
                source = "Referral",
                expYears = 7,
                education = "BSc",
                skills = new[] { "C#", "SQL" },
                languages = new[] { "Arabic", "English" },
                shift = "Evenings",
                salaryExp = 9000,
                availability = "2 weeks",
                answers = Array.Empty<object>(),
            });
            Assert.Equal(HttpStatusCode.Created, submit.StatusCode);

            var list = await GetJsonAsync($"/api/applications?formId={formId}", admin);
            var item = list.GetProperty("items").EnumerateArray().Single();
            Assert.Equal("Head Office", item.GetProperty("gym").GetString());   // gymPref wins over gym
            Assert.Equal(position, item.GetProperty("position").GetString());   // typed position kept
        }

        // ------------------------------------------------------------------
        // Applicant pane (authenticated list / detail / reject)
        // ------------------------------------------------------------------

        [Fact]
        public async Task List_FiltersStatusSearchAndPaging()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var suffix = UniqueSuffix();
            var formId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Filter Form {suffix}", $"Filter Role {suffix}"));
            var first = $"First Applicant {suffix}";
            await SubmitApplicationAsync(new { formId, name = first, email = $"first-{suffix}@test.local", phone = "+1" });
            await SubmitApplicationAsync(new { formId, name = $"Second Applicant {suffix}", email = $"second-{suffix}@test.local", phone = "+1" });

            var byStatus = await GetJsonAsync($"/api/applications?formId={formId}&status=New", admin);
            Assert.Equal(2, byStatus.GetProperty("total").GetInt32());
            Assert.All(byStatus.GetProperty("items").EnumerateArray(),
                i => Assert.Equal("New", i.GetProperty("status").GetString()));

            var bogusStatus = await GetJsonAsync($"/api/applications?formId={formId}&status=Bogus", admin);
            Assert.Equal(0, bogusStatus.GetProperty("total").GetInt32());

            var bySearch = await GetJsonAsync(
                $"/api/applications?formId={formId}&searchTerm={Uri.EscapeDataString(first)}", admin);
            Assert.Equal(1, bySearch.GetProperty("total").GetInt32());
            Assert.Equal(first, bySearch.GetProperty("items").EnumerateArray().Single().GetProperty("name").GetString());

            var paged = await GetJsonAsync($"/api/applications?formId={formId}&pageSize=1", admin);
            Assert.Equal(2, paged.GetProperty("total").GetInt32());
            Assert.Equal(2, paged.GetProperty("totalPages").GetInt32());
            Assert.Single(paged.GetProperty("items").EnumerateArray());
        }

        [Fact]
        public async Task List_IsGymScopedByPreferredBranch()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var builder = NewBuilder();
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gymA });
            await builder.GrantPermissionAsync(hr.UserId, "recruitment.candidates.manage");
            var hrToken = await _fixture.LoginAsync(hr.Email, hr.Password);

            var suffix = UniqueSuffix();
            var formId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Scope Form {suffix}", $"Scope Role {suffix}"));
            var inScope = await SubmitAndGetIdAsync(formId, $"Scope Inside {suffix}", gym: gymA.Name);
            var outScope = await SubmitAndGetIdAsync(formId, $"Scope Outside {suffix}", gym: gymB.Name);
            var noGym = await SubmitAndGetIdAsync(formId, $"Scope Anywhere {suffix}");

            var list = await GetJsonAsync($"/api/applications?formId={formId}", hrToken);
            var ids = list.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetInt32()).ToList();
            Assert.Contains(inScope, ids);
            Assert.Contains(noGym, ids);
            Assert.DoesNotContain(outScope, ids);

            // Cross-branch detail is gated at the target's branch.
            var crossDetail = await SendAsync(HttpMethod.Get, $"/api/applications/{outScope}", null, hrToken);
            await AssertErrorAsync(crossDetail, HttpStatusCode.Unauthorized);
        }

        [Fact]
        public async Task DetailAndReject_ReturnAnswersAndComment()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var suffix = UniqueSuffix();
            var formId = await CreateHiringFormIdAsync(admin,
                HiringFormBody($"Reject Form {suffix}", $"Reject Role {suffix}"));
            var firstName = $"Reject Me {suffix}";
            await SubmitApplicationAsync(new
            {
                formId,
                name = firstName,
                email = $"reject-{suffix}@test.local",
                phone = "+1",
                answers = new object[]
                {
                    new { question = "Why do you want to join?", type = "text", answer = "I do not." },
                },
            });
            var applicationId = await FindApplicationIdAsync(formId, firstName);

            var missing = await SendAsync(HttpMethod.Get, "/api/applications/2147483000", null, admin);
            await AssertErrorAsync(missing, HttpStatusCode.NotFound);

            var detailBefore = await GetJsonAsync($"/api/applications/{applicationId}", admin);
            var dataBefore = detailBefore.GetProperty("data");
            Assert.Equal("New", dataBefore.GetProperty("status").GetString());
            Assert.Equal(JsonValueKind.Null, dataBefore.GetProperty("rejectComment").ValueKind);
            Assert.Equal("I do not.", dataBefore.GetProperty("answers").EnumerateArray()
                .Single().GetProperty("answer").GetString());

            var reject = await SendAsync(HttpMethod.Put, $"/api/applications/{applicationId}/reject",
                new { comment = "Not a fit for the team." }, admin);
            Assert.Equal(HttpStatusCode.OK, reject.StatusCode);
            var rejected = (await ReadElementAsync(reject)).GetProperty("data");
            Assert.Equal(applicationId, rejected.GetProperty("id").GetInt32());
            Assert.Equal("Rejected", rejected.GetProperty("status").GetString());

            var detailAfter = await GetJsonAsync($"/api/applications/{applicationId}", admin);
            Assert.Equal("Rejected", detailAfter.GetProperty("data").GetProperty("status").GetString());
            Assert.Equal("Not a fit for the team.", detailAfter.GetProperty("data").GetProperty("rejectComment").GetString());
            Assert.Equal("I do not.", detailAfter.GetProperty("data").GetProperty("answers").EnumerateArray()
                .Single().GetProperty("answer").GetString());
        }

        // ------------------------------------------------------------------
        // Convert to pipeline (POST /api/candidates)
        // ------------------------------------------------------------------

        [Fact]
        public async Task Convert_CareersApplicantBecomesPipelineCandidate()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var suffix = UniqueSuffix();
            var position = $"Platform Engineer {suffix}";
            var name = $"Convert Me {suffix}";
            var formName = $"Convertible Roles {suffix}";
            var formId = await CreateHiringFormIdAsync(admin, HiringFormBody(formName, position));

            await SubmitApplicationAsync(new
            {
                formId,
                name,
                email = $"convert-{suffix}@test.local",
                phone = "+15550003333",
                gym = gym.Name,
                position,
                source = "Referral",
                expYears = 5,
                education = "BSc",
                skills = new[] { "SQL" },
                languages = new[] { "Arabic" },
                shift = "Morning",
                salaryExp = 8000,
                availability = "Immediate",
                answers = Array.Empty<object>(),
            });
            var applicationId = await FindApplicationIdAsync(formId, name);

            var convert = await PostAsync("/api/candidates", new { applicationId }, admin);
            Assert.Equal(HttpStatusCode.Created, convert.StatusCode);
            var convertBody = await ReadElementAsync(convert);
            var data = convertBody.GetProperty("data");
            var applicationStatus = convertBody.GetProperty("applicationStatus");

            Assert.True(data.GetProperty("id").GetInt32() > 0);
            Assert.Equal(name, data.GetProperty("name").GetString());
            Assert.Equal(position, data.GetProperty("position").GetString());
            Assert.Equal("Applied", data.GetProperty("stage").GetString());
            Assert.Equal(0, data.GetProperty("rating").GetInt32());
            Assert.Equal("+15550003333", data.GetProperty("phone").GetString());
            Assert.Equal("Moved to Pipeline", applicationStatus.GetString());
            Assert.Equal(JsonValueKind.Null, data.GetProperty("screen").ValueKind);
            Assert.Equal(JsonValueKind.Null, data.GetProperty("decision").ValueKind);

            var formBlock = data.GetProperty("form");
            Assert.Equal($"convert-{suffix}@test.local", formBlock.GetProperty("email").GetString());
            Assert.Equal("Referral", formBlock.GetProperty("source").GetString());
            Assert.Equal(gym.Name, formBlock.GetProperty("gymPref").GetString());
            Assert.Equal(5, formBlock.GetProperty("expYears").GetInt32());
            Assert.Equal("BSc", formBlock.GetProperty("education").GetString());
            Assert.Equal("SQL", formBlock.GetProperty("skills").EnumerateArray().Single().GetString());
            Assert.Equal("Morning", formBlock.GetProperty("shift").GetString());
            Assert.Equal(8000, formBlock.GetProperty("salaryExp").GetInt32());
            Assert.Equal("Immediate", formBlock.GetProperty("availability").GetString());

            // The vacancy-less application shows up in the pipeline under its position.
            var pipeline = await GetJsonAsync(
                $"/api/candidates?searchTerm={Uri.EscapeDataString(name)}", admin);
            var card = pipeline.GetProperty("items").EnumerateArray().Single();
            Assert.Equal(data.GetProperty("id").GetInt32(), card.GetProperty("id").GetInt32());
            Assert.Equal("Applied", card.GetProperty("stage").GetString());
            Assert.Equal(position, card.GetProperty("position").GetString());

            // Applicant row flipped; double convert and reject are blocked afterwards.
            var flipped = await GetJsonAsync($"/api/applications/{applicationId}", admin);
            Assert.Equal("Moved to Pipeline", flipped.GetProperty("data").GetProperty("status").GetString());

            var again = await PostAsync("/api/candidates", new { applicationId }, admin);
            Assert.Contains("already in the pipeline", await AssertErrorAsync(again, HttpStatusCode.BadRequest));

            var reject = await SendAsync(HttpMethod.Put, $"/api/applications/{applicationId}/reject",
                new { comment = "late" }, admin);
            Assert.Contains("already in the pipeline", await AssertErrorAsync(reject, HttpStatusCode.BadRequest));
        }

        [Fact]
        public async Task Convert_FormApplicantGetsSpecDefaults()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var suffix = UniqueSuffix();
            var formName = $"Plain Roles {suffix}";
            var name = $"Plain Applicant {suffix}";
            var formId = await CreateHiringFormIdAsync(admin, HiringFormBody(formName, $"Plain Role {suffix}"));
            await SubmitApplicationAsync(new
            {
                formId,
                name,
                email = $"plain-{suffix}@test.local",
                phone = "+1",
                gym = "Cairo West",
                answers = Array.Empty<object>(),
            });
            var applicationId = await FindApplicationIdAsync(formId, name);

            var convert = await PostAsync("/api/candidates", new { applicationId }, admin);
            Assert.Equal(HttpStatusCode.Created, convert.StatusCode);
            var data = (await ReadElementAsync(convert)).GetProperty("data");

            var formBlock = data.GetProperty("form");
            Assert.Equal($"Hiring Form — {formName}", formBlock.GetProperty("source").GetString());
            Assert.Equal("Cairo West", formBlock.GetProperty("gymPref").GetString());
            Assert.Equal(0, formBlock.GetProperty("expYears").GetInt32());
            Assert.Equal(string.Empty, formBlock.GetProperty("education").GetString());
            Assert.Empty(formBlock.GetProperty("skills").EnumerateArray());
            Assert.Empty(formBlock.GetProperty("languages").EnumerateArray());
            Assert.Equal("Any", formBlock.GetProperty("shift").GetString());
            Assert.Equal(0, formBlock.GetProperty("salaryExp").GetInt32());
            Assert.Equal("Immediate", formBlock.GetProperty("availability").GetString());
        }

        [Fact]
        public async Task Convert_ValidationErrors()
        {
            var admin = await _fixture.GetAdminTokenAsync();

            var noId = await PostAsync("/api/candidates", new { }, admin);
            Assert.Contains("applicationId is required",
                await AssertErrorAsync(noId, HttpStatusCode.BadRequest));

            var missing = await PostAsync("/api/candidates", new { applicationId = 2147483000 }, admin);
            await AssertErrorAsync(missing, HttpStatusCode.NotFound);
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        /// <summary>Submits an anonymous application and resolves its row id through the admin list.</summary>
        private async Task<int> SubmitAndGetIdAsync(int formId, string name, string? gym = null)
        {
            var response = await SubmitApplicationAsync(new
            {
                formId,
                name,
                email = $"app-{UniqueSuffix()}@test.local",
                phone = "+15550004444",
                gym,
            });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return await FindApplicationIdAsync(formId, name);
        }

        /// <summary>Resolves an applicant row id by its exact name within a form.</summary>
        private async Task<int> FindApplicationIdAsync(int formId, string name)
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var list = await GetJsonAsync(
                $"/api/applications?formId={formId}&searchTerm={Uri.EscapeDataString(name)}", admin);
            return list.GetProperty("items").EnumerateArray()
                .Single(i => i.GetProperty("name").GetString() == name)
                .GetProperty("id").GetInt32();
        }
    }
}
