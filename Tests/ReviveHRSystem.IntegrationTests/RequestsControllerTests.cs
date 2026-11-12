using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Requests module (S3, Section 4 R1–R7 + A2/A6/A8): the paged inbox with its
    /// status/type/date/quick filters, detail, on-behalf creation by name, the HR
    /// decision stage (approve/reject + payment handling + resignation offboarding),
    /// decision undo, bulk approve, archive/restore, and the employee-file
    /// requests tab.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class RequestsControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public RequestsControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        // ------------------------------------------------------------------
        // GET /api/requests — list (R1)
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetRequests_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/requests");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetRequests_HrWithoutRequestsView_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/requests", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetRequests_Admin_ReturnsEnvelopeWithCreatedRequest()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(3));

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/requests", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(body.TryGetProperty("page", out _));
            Assert.True(body.TryGetProperty("pageSize", out _));
            Assert.True(body.TryGetProperty("total", out _));
            Assert.True(body.TryGetProperty("totalPages", out _));

            var id = created.GetProperty("data").GetProperty("id").GetInt32();
            var items = body.GetProperty("items").EnumerateArray().ToList();
            var item = Assert.Single(items, i => i.GetProperty("id").GetInt32() == id);
            Assert.Equal("Pending HR Review", item.GetProperty("status").GetString());
            Assert.Equal(employee.FullName, item.GetProperty("employee").GetString());
            Assert.Equal(gym.Name, item.GetProperty("gym").GetString());
            Assert.Equal("Day Off", item.GetProperty("type").GetString());
        }

        [Fact]
        public async Task GetRequests_StatusFilter_ReturnsOnlyMatchingStatus()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            var pending = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(5));
            var approved = await CreateRequestAsync(token, employee.FullName, "Late Arrival", FutureDate(6));
            var approvedId = approved.GetProperty("data").GetProperty("id").GetInt32();
            await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{approvedId}/decide",
                new { stage = "HR", decision = "Approved" }, token));

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/requests?status=Approved", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.DoesNotContain(items, i => i.GetProperty("id").GetInt32() == pending.GetProperty("data").GetProperty("id").GetInt32());
            Assert.Contains(items, i => i.GetProperty("id").GetInt32() == approvedId);
        }

        [Fact]
        public async Task GetRequests_TypeFilter_ReturnsOnlyMatchingType()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            var dayOff = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(7));
            await CreateRequestAsync(token, employee.FullName, "Sick Leave", FutureDate(8));

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/requests?type=Day%20Off", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var id = dayOff.GetProperty("data").GetProperty("id").GetInt32();
            Assert.Single(items, i => i.GetProperty("id").GetInt32() == id);
            Assert.All(items, i => Assert.Equal("Day Off", i.GetProperty("type").GetString()));
        }

        [Fact]
        public async Task GetRequests_DateFilter_MatchesSpanCoveringThatDay()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            var spanStart = FutureDate(10);
            var spanEnd = FutureDate(12);
            var spanning = await CreateRequestAsync(token, employee.FullName, "Day Off", spanStart, spanEnd);
            var outside = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(20));

            // A day inside the [spanStart, spanEnd] window should match the range
            // request but not the one scheduled later.
            var insideDay = FutureDate(11);
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/requests?date={insideDay}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var spanningId = spanning.GetProperty("data").GetProperty("id").GetInt32();
            var outsideId = outside.GetProperty("data").GetProperty("id").GetInt32();
            Assert.Contains(items, i => i.GetProperty("id").GetInt32() == spanningId);
            Assert.DoesNotContain(items, i => i.GetProperty("id").GetInt32() == outsideId);
        }

        [Fact]
        public async Task GetRequests_QuickUrgent_ReturnsOnlyUrgentPendingTypes()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            var urgent = await CreateRequestAsync(token, employee.FullName, "Sick Leave", FutureDate(4));
            await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(9));

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/requests?quick=urgent", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var urgentId = urgent.GetProperty("data").GetProperty("id").GetInt32();
            Assert.Contains(items, i => i.GetProperty("id").GetInt32() == urgentId);
            Assert.All(items, i => Assert.Contains(
                i.GetProperty("type").GetString(),
                new[] { "Late Arrival", "Leave Early", "Sick Leave" }));
        }

        // ------------------------------------------------------------------
        // GET /api/requests/{id} — detail (R2)
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetRequest_UnknownId_Returns404()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/requests/999999", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task GetRequest_ById_ReturnsItemWithTimeline()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(3));
            var id = created.GetProperty("data").GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/requests/{id}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var item = body.GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(id, item.GetProperty("id").GetInt32());
            Assert.Equal("Pending HR Review", item.GetProperty("status").GetString());

            var timeline = item.GetProperty("timeline").EnumerateArray().ToList();
            Assert.Equal("Submitted", timeline[0].GetProperty("step").GetString());
            Assert.True(timeline[0].GetProperty("done").GetBoolean());
            Assert.Equal("HR Review", timeline[^1].GetProperty("step").GetString());
            Assert.False(timeline[^1].GetProperty("done").GetBoolean());
        }

        // ------------------------------------------------------------------
        // POST /api/requests — create (R7)
        // ------------------------------------------------------------------

        [Fact]
        public async Task CreateRequest_ByName_Returns201PendingHRReview()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/requests", new { employee = employee.FullName, type = "Day Off", requestedDate = FutureDate(3), reason = "Family day" }, token));
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var data = body.GetProperty("data");
            Assert.True(data.GetProperty("id").GetInt32() > 0);
            Assert.Equal("Pending HR Review", data.GetProperty("status").GetString());

            var timeline = data.GetProperty("timeline").EnumerateArray().ToList();
            Assert.Equal("Submitted", timeline[0].GetProperty("step").GetString());
            Assert.Equal("HR Review", timeline[^1].GetProperty("step").GetString());
        }

        [Fact]
        public async Task CreateRequest_UnknownEmployeeName_Returns400()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/requests", new { employee = "No Such Person", type = "Day Off", requestedDate = FutureDate(3) }, token));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateRequest_UnknownType_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/requests", new { employee = employee.FullName, type = "Not A Type", requestedDate = FutureDate(3) }, token));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // POST /api/requests/{id}/decide — HR decision (R3/A6)
        // ------------------------------------------------------------------

        [Fact]
        public async Task Decide_ApprovePaidDayOff_DeductsLeaveBalance()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            await builder.SetLeaveBalanceAsync(employee.EmployeeId, total: 10, used: 2);
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(3));
            var id = created.GetProperty("data").GetProperty("id").GetInt32();

            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/decide", new { stage = "HR", decision = "Approved", payment = "paid" }, token));
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("Approved", body.GetProperty("item").GetProperty("status").GetString());
            Assert.Equal("paid", body.GetProperty("item").GetProperty("payment").GetString());

            var balance = await GetLeaveBalanceAsync(employee.EmployeeId);
            Assert.Equal(3, balance); // 2 used + 1 deducted
        }

        [Fact]
        public async Task Decide_ApproveUnpaidDayOff_LeavesBalanceUntouched()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            await builder.SetLeaveBalanceAsync(employee.EmployeeId, total: 10, used: 2);
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(3));
            var id = created.GetProperty("data").GetProperty("id").GetInt32();

            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/decide", new { stage = "HR", decision = "Approved", payment = "unpaid" }, token));
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("unpaid", body.GetProperty("item").GetProperty("payment").GetString());

            var balance = await GetLeaveBalanceAsync(employee.EmployeeId);
            Assert.Equal(2, balance); // unchanged
        }

        [Fact]
        public async Task Decide_RejectWithoutComment_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(3));
            var id = created.GetProperty("data").GetProperty("id").GetInt32();

            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/decide", new { stage = "HR", decision = "Rejected" }, token));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Decide_ApproveResignation_SetsNoticePeriodAndOffboardingPrompt()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateRequestAsync(token, employee.FullName, "Resignation", FutureDate(3));
            var id = created.GetProperty("data").GetProperty("id").GetInt32();

            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/decide", new { stage = "HR", decision = "Approved" }, token));
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(body.GetProperty("offboardingPrompt").GetBoolean());
            Assert.Equal("Notice Period", await GetEmployeeStatusAsync(employee.EmployeeId));
        }

        [Fact]
        public async Task Decide_AlreadyDecided_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(3));
            var id = created.GetProperty("data").GetProperty("id").GetInt32();

            await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/decide", new { stage = "HR", decision = "Approved", payment = "unpaid" }, token));
            var second = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/decide", new { stage = "HR", decision = "Rejected", comment = "no" }, token));

            Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        }

        // ------------------------------------------------------------------
        // POST /api/requests/{id}/undo-decision — undo (R4)
        // ------------------------------------------------------------------

        [Fact]
        public async Task UndoDecision_ReturnsToPendingHRAndRestoresBalance()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            await builder.SetLeaveBalanceAsync(employee.EmployeeId, total: 10, used: 2);
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(3));
            var id = created.GetProperty("data").GetProperty("id").GetInt32();

            await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/decide", new { stage = "HR", decision = "Approved", payment = "paid" }, token));
            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/undo-decision", new { }, token));
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("Pending HR Review", body.GetProperty("item").GetProperty("status").GetString());
            Assert.Equal(2, await GetLeaveBalanceAsync(employee.EmployeeId)); // day returned
        }

        [Fact]
        public async Task UndoDecision_PastDate_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateRequestAsync(token, employee.FullName, "Day Off", PastDate(3));
            var id = created.GetProperty("data").GetProperty("id").GetInt32();

            await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/decide", new { stage = "HR", decision = "Approved", payment = "unpaid" }, token));
            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/undo-decision", new { }, token));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // POST /api/requests/bulk-decide — bulk approve (R5)
        // ------------------------------------------------------------------

        [Fact]
        public async Task BulkDecide_WithIds_ApprovesPendingAndCountsUnpaid()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            await builder.SetLeaveBalanceAsync(employee.EmployeeId, total: 10, used: 10); // exhausted → unpaid
            var token = await _fixture.GetAdminTokenAsync();

            var first = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(3));
            var second = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(4));
            var ids = new[]
            {
                first.GetProperty("data").GetProperty("id").GetInt32(),
                second.GetProperty("data").GetProperty("id").GetInt32(),
            };

            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/requests/bulk-decide", new { decision = "Approved", requestIds = ids }, token));
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(2, body.GetProperty("approved").GetInt32());
            Assert.Equal(2, body.GetProperty("unpaidApplied").GetInt32());
            Assert.Equal(10, await GetLeaveBalanceAsync(employee.EmployeeId)); // no deduction (unpaid)
        }

        // ------------------------------------------------------------------
        // POST /api/requests/{id}/archive · restore (R6)
        // ------------------------------------------------------------------

        [Fact]
        public async Task ArchiveThenRestore_DerivesPreArchiveStatus()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(3));
            var id = created.GetProperty("data").GetProperty("id").GetInt32();

            var archived = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/archive", null, token));
            Assert.Equal(HttpStatusCode.OK, archived.StatusCode);

            var restored = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{id}/restore", null, token));
            Assert.Equal(HttpStatusCode.OK, restored.StatusCode);

            // No decisions recorded → restore lands back at the BM-pending stage.
            var detail = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/requests/{id}", null, token));
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Pending", body.GetProperty("data").GetProperty("status").GetString());
        }

        // ------------------------------------------------------------------
        // GET /api/employees/{id}/requests — employee file tab (A8)
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetEmployeeRequests_ReturnsPlainArrayWithBmComment()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            await CreateRequestAsync(token, employee.FullName, "Day Off", FutureDate(3));

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employee.EmployeeId}/requests", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var items = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var array = Assert.IsType<JsonElement>(items);
            var list = array.EnumerateArray().ToList();
            var item = Assert.Single(list);
            Assert.Equal("Day Off", item.GetProperty("type").GetString());
            Assert.Equal("Pending HR Review", item.GetProperty("status").GetString());
            Assert.True(item.TryGetProperty("bmComment", out _));
        }

        // ------------------------------------------------------------------
        // Two-sided pipeline: employee submission <-> HR inbox (R1/R3/R10)
        // ------------------------------------------------------------------

        [Fact]
        public async Task HrSeesStageOneRequest_AndDecidingItReleasesTheReservation()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            await builder.SetLeaveBalanceAsync(employee.EmployeeId, total: 10, used: 1);
            var requestId = await SeedStageOneRequestAsync(employee.EmployeeId, "Annual Leave", reservedDays: 1);
            var token = await _fixture.GetAdminTokenAsync();

            // The pending tab lists stage-1 requests and tags them for the UI.
            var listResponse = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/requests?status=Pending%20HR%20Review&pageSize=100", null, token));
            var list = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            var row = list.GetProperty("items").EnumerateArray()
                .Single(i => i.GetProperty("id").GetInt32() == requestId);
            Assert.True(row.GetProperty("awaitingManager").GetBoolean());

            var summaryResponse = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/requests/summary", null, token));
            summaryResponse.EnsureSuccessStatusCode();
            var summary = await summaryResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(summary.GetProperty("awaitingManager").GetInt32() >= 1);

            // HR decides a paid approval directly: used +1, the reserved day released once.
            var decide = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{requestId}/decide",
                new { stage = "HR", decision = "Approved", payment = "paid" }, token));
            Assert.Equal(HttpStatusCode.OK, decide.StatusCode);

            var (used, pending) = await BalanceBucketsAsync(employee.EmployeeId);
            Assert.Equal(2m, used);
            Assert.Equal(0m, pending);
        }

        [Fact]
        public async Task HrRejectingStageOneRequest_ReleasesTheReservedDays()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            await builder.SetLeaveBalanceAsync(employee.EmployeeId, total: 10, used: 1);
            var requestId = await SeedStageOneRequestAsync(employee.EmployeeId, "Annual Leave", reservedDays: 1);
            var token = await _fixture.GetAdminTokenAsync();

            var decide = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{requestId}/decide",
                new { stage = "HR", decision = "Rejected", comment = "Coverage gap" }, token));
            Assert.Equal(HttpStatusCode.OK, decide.StatusCode);

            var (used, pending) = await BalanceBucketsAsync(employee.EmployeeId);
            Assert.Equal(1m, used);
            Assert.Equal(0m, pending);
        }

        [Fact]
        public async Task Submit_WhenGymHasNoManager_AdvancesStraightToHr()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            await builder.SetLeaveBalanceAsync(employee.EmployeeId, total: 10, used: 0);

            var login = await _fixture.Client.PostAsJsonAsync(
                "/api/auth/login", new { email = employee.Email, password = employee.Password });
            login.EnsureSuccessStatusCode();
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            var token = loginBody.GetProperty("accessToken").GetString()!;

            using var content = new MultipartFormDataContent
            {
                { new StringContent("annual-leave"), "type" },
                { new StringContent(FutureDate(5)), "requestDate" },
                { new StringContent("Family trip"), "reason" },
            };
            // Multipart content carries its own boundary — AuthorizedRequest would
            // attach JSON content instead, hence the hand-built request.
            using var submitRequest = new HttpRequestMessage(
                HttpMethod.Post, $"/api/employees/{employee.EmployeeId}/requests")
            {
                Content = content,
            };
            submitRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            var submit = await _fixture.Client.SendAsync(submitRequest);
            Assert.Equal(HttpStatusCode.Created, submit.StatusCode);
            var body = await submit.Content.ReadFromJsonAsync<JsonElement>();
            var id = body.GetProperty("id").GetInt32();

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Presistence.Data.ReviveHrDbContext>();
            var request = await db.EmployeeRequests.SingleAsync(r => r.Id == id);
            Assert.Equal(DomainLayer.Models.RequestModule.Enums.RequestStatus.PendingHRReview, request.Status);
            Assert.Equal(1m, (await db.LeaveBalances
                .Where(b => b.EmployeeId == employee.EmployeeId)
                .Select(b => b.PendingDays)
                .SingleAsync()));
        }

        /// <summary>Seeds a stage-1 request plus the pending days its submission reserved.</summary>
        private async Task<int> SeedStageOneRequestAsync(int employeeId, string type, decimal reservedDays)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Presistence.Data.ReviveHrDbContext>();

            var balance = await db.LeaveBalances
                .SingleAsync(b => b.EmployeeId == employeeId && b.LeaveType == DomainLayer.Models.EmployeeModule.Enums.LeaveType.Annual);
            balance.PendingDays += reservedDays;

            var request = new DomainLayer.Models.RequestModule.EmployeeRequest
            {
                EmployeeId = employeeId,
                Type = type,
                RequestDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5),
                TargetStartDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5),
                Details = "Family event",
                Status = DomainLayer.Models.RequestModule.Enums.RequestStatus.Pending,
                SubmittedAt = DateTime.UtcNow,
            };
            db.EmployeeRequests.Add(request);
            await db.SaveChangesAsync();
            return request.Id;
        }

        private async Task<(decimal Used, decimal Pending)> BalanceBucketsAsync(int employeeId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Presistence.Data.ReviveHrDbContext>();
            var balance = await db.LeaveBalances
                .SingleAsync(b => b.EmployeeId == employeeId && b.LeaveType == DomainLayer.Models.EmployeeModule.Enums.LeaveType.Annual);
            return (balance.UsedDays, balance.PendingDays);
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private async Task<JsonElement> CreateRequestAsync(string token, string employeeName, string type, string requestedDate, string? endDate = null)
        {
            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/requests", new { employee = employeeName, type, requestedDate, endDate = endDate ?? (string?)null }, token));
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }

        private async Task<decimal> GetLeaveBalanceAsync(int employeeId)
        {
            var token = await _fixture.GetAdminTokenAsync();
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeId}/leave-balance", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return body.GetProperty("dayOff").GetProperty("used").GetDecimal();
        }

        private async Task<string?> GetEmployeeStatusAsync(int employeeId)
        {
            var token = await _fixture.GetAdminTokenAsync();
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return body.GetProperty("data").GetProperty("status").GetString();
        }

        private static string FutureDate(int daysAhead) =>
            DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(daysAhead)).ToString("yyyy-MM-dd");

        private static string PastDate(int daysAgo) =>
            DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-daysAgo)).ToString("yyyy-MM-dd");
    }
}
