using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.RequestModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Employee-portal self-service reads and the stage-1 request desk:
    ///   - the employee-file tabs (requests A8, attendance A7, payroll A8slip,
    ///     evaluations A11, documents A3, history A9, leave balance A5) read the
    ///     caller's own record with no permission key at all (self-service);
    ///   - others keep their key guards (a self PUT of the leave balance stays
    ///     forbidden — employees never widen their own balances);
    ///   - GET /api/requests/inbox + POST /api/requests/{id}/decisions are the
    ///     Team-Leader/Branch-Manager desk (team scope for the leader, gym for
    ///     the manager) and stage-1 approval moves a request to HR review.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class EmployeePortalSelfReadTests
    {
        private readonly ApiTestFixture _fixture;

        public EmployeePortalSelfReadTests(ApiTestFixture fixture) => _fixture = fixture;

        // ------------------------------------------------------------------
        // Session context (B0): employee id and led team on /api/me
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetMe_PlainEmployee_ReportsOwnEmployeeId()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var me = await GetJsonAsync("/api/me", token);

            Assert.Equal(employeeId, me.GetProperty("employeeId").GetInt32());
        }

        [Fact]
        public async Task GetMe_TeamLeaderAtGym2_ReportsLedTeam()
        {
            var token = await LoginOmarAtGym2Async();

            var me = await GetJsonAsync("/api/me", token);

            Assert.Equal("Team Leader", me.GetProperty("roleInActiveGym").GetString());
            Assert.True(me.GetProperty("ledTeamId").GetInt32() > 0);
        }

        // ------------------------------------------------------------------
        // Self reads without permission keys
        // ------------------------------------------------------------------

        [Fact]
        public async Task OwnRequestsTab_ReadsWithoutKey()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{employeeId}/requests", null, token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(JsonValueKind.Array, body.ValueKind);
        }

        [Fact]
        public async Task OwnAttendanceTab_ReadsWithoutKey()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{employeeId}/attendance", null, token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task OwnPayrollTab_ReadsWithoutKey()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{employeeId}/payroll", null, token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task OwnEvaluationsTab_ReadsWithoutKey()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{employeeId}/evaluations", null, token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task OwnDocumentsTab_ReadsWithoutKey()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{employeeId}/documents", null, token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(JsonValueKind.Array, body.ValueKind);
        }

        [Fact]
        public async Task OwnHistoryTab_ReadsWithoutKey()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{employeeId}/history", null, token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(JsonValueKind.Array, body.ValueKind);
        }

        [Fact]
        public async Task OwnLeaveBalance_ReadsWithoutKey()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{employeeId}/leave-balance", null, token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(body.TryGetProperty("dayOff", out _));
        }

        [Fact]
        public async Task OwnRequestDetail_ReadsWithoutKey()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var requestId = await CreateOwnRequestAsync(employeeId, token);

            var detail = await SendAsync(HttpMethod.Get, $"/api/requests/{requestId}", null, token);

            Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Paid Holiday", body.GetProperty("data").GetProperty("type").GetString());
        }

        /// <summary>The leave-balance PUT remains an HR action even on the caller's own record.</summary>
        [Fact]
        public async Task LeaveBalance_SelfPut_StillForbidden()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var body = new
            {
                dayOff = new { used = 0, total = 21 },
                sick = new { used = 0, total = 10 },
                unpaid = new { used = 0, total = 0 },
            };
            var response = await SendAsync(HttpMethod.Put, $"/api/employees/{employeeId}/leave-balance", body, token);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // Stage-1 desk (team scope / gym scope — no permission keys)
        // ------------------------------------------------------------------

        [Fact]
        public async Task Inbox_TeamLeaderIncludesTeamMemberRequestAndExcludesOthers()
        {
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");
            var saraToken = await _fixture.LoginAsync("sara@revive.hr", "Revive!2026");
            var saraRequestId = await CreateOwnRequestAsync(saraId, saraToken);

            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");
            var karimToken = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var karimRequestId = await CreateOwnRequestAsync(karimId, karimToken);

            // Omar as Team Leader at gym2: sees his team (sara), not other gyms' staff.
            var token = await LoginOmarAtGym2Async();
            var inbox = await GetJsonAsync("/api/requests/inbox", token);

            var ids = inbox.GetProperty("items").EnumerateArray()
                .Select(i => i.GetProperty("id").GetInt32())
                .ToHashSet();
            Assert.Contains(saraRequestId, ids);
            Assert.DoesNotContain(karimRequestId, ids);
        }

        [Fact]
        public async Task Inbox_BranchManagerIncludesWholeGym()
        {
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");
            var karimToken = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var karimRequestId = await CreateOwnRequestAsync(karimId, karimToken);

            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");
            var saraToken = await _fixture.LoginAsync("sara@revive.hr", "Revive!2026");
            var saraRequestId = await CreateOwnRequestAsync(saraId, saraToken);

            // Omar as Branch Manager at gym1: sees gym1 staff only.
            var token = await LoginOmarAtGym1Async();
            var inbox = await GetJsonAsync("/api/requests/inbox", token);

            var ids = inbox.GetProperty("items").EnumerateArray()
                .Select(i => i.GetProperty("id").GetInt32())
                .ToHashSet();
            Assert.Contains(karimRequestId, ids);
            Assert.DoesNotContain(saraRequestId, ids);
        }

        [Fact]
        public async Task DeskDecision_TeamLeaderApprove_MovesRequestToHrReview()
        {
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");
            var saraToken = await _fixture.LoginAsync("sara@revive.hr", "Revive!2026");
            var requestId = await CreateOwnRequestAsync(saraId, saraToken);

            var token = await LoginOmarAtGym2Async();
            var response = await SendAsync(
                HttpMethod.Post, $"/api/requests/{requestId}/decisions",
                new { decision = "approve", comment = "Approved for HR review" }, token);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var request = await db.EmployeeRequests.FindAsync(requestId);
            Assert.Equal(RequestStatus.PendingHRReview, request!.Status);
        }

        [Fact]
        public async Task DeskDecision_PlainEmployeeProcessingOwnRequest_Returns404()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var requestId = await CreateOwnRequestAsync(employeeId, token);

            var response = await SendAsync(
                HttpMethod.Post, $"/api/requests/{requestId}/decisions", new { decision = "approve" }, token);

            // Karim is not in scope for the stage-1 desk (no team role, no gym role),
            // so the desk answers NotFound just like every other out-of-scope read.
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var request = await db.EmployeeRequests.FindAsync(requestId);
            Assert.Equal(RequestStatus.Pending, request!.Status);
        }

        [Fact]
        public async Task Colleagues_PlainEmployee_IsDenied()
        {
            // Matrix row 36 (converged): the colleague/swap-picker belongs to the
            // negotiators (branch manager, team leader) — a plain employee does not
            // get a roster, not even for his own profile.
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{employeeId}/colleagues", null, token);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Colleagues_OthersEmployee_IsNotFound()
        {
            var karimToken = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{saraId}/colleagues", null, karimToken);

            // The picker only serves the caller's own swap request.
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task PayrollSheets_OwnList_SelfReadable()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{employeeId}/payroll-sheets", null, token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(JsonValueKind.Array, body.ValueKind);
        }

        [Fact]
        public async Task PayrollSheets_OtherEmployee_IsNotFound()
        {
            var karimToken = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{saraId}/payroll-sheets", null, karimToken);

            // Salary data is owner-scoped: another employee's sheets do not exist.
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task PayrollSlip_OwnEntry_ReturnsPayslipCard()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var gymId = await db.Employees.Where(e => e.Id == employeeId).Select(e => e.GymId).SingleAsync();

            var builder = new TestDataBuilder(_fixture.Services);
            var periodId = await builder.CreatePayrollPeriodAsync(
                gymId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30),
                DomainLayer.Models.PayrollModule.Enums.PayrollPeriodStatus.Locked);
            var entryId = await builder.CreatePayrollEntryAsync(periodId, employeeId, 9000, bonus: 250, overtimeHours: 4);
            await builder.AddPayrollLineAsync(entryId, 120, "Approved");

            var slip = await GetJsonAsync($"/api/employees/{employeeId}/payroll/{entryId}/payslip", token);
            var data = slip.GetProperty("data");
            Assert.Equal("September 2026", data.GetProperty("period").GetString());
            Assert.Equal(9000m, data.GetProperty("baseSalary").GetDecimal());
            // net = base 9000 + bonus 250 + OT pay (9000/176×1.5×4 = 306.82) − accepted deduction 120
            Assert.Equal(9436.82m, data.GetProperty("net").GetDecimal());
        }

        /// <summary>The rich evaluation view (criteria + reviewer) is self-readable without evaluations.view.</summary>
        [Fact]
        public async Task EvaluationDetails_OwnList_ReadsWithoutKey()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{employeeId}/evaluations/detail", null, token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(JsonValueKind.Array, body.ValueKind);
        }

        [Fact]
        public async Task EvaluationDetails_OtherEmployee_IsNotFound()
        {
            var karimToken = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");

            var response = await SendAsync(HttpMethod.Get, $"/api/employees/{saraId}/evaluations/detail", null, karimToken);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }

        /** Self-created balance-free request (paid holiday = date + reason only). */
        private async Task<int> CreateOwnRequestAsync(int employeeId, string token)
        {
            var form = new MultipartFormDataContent();
            form.Add(new StringContent("paid-holiday"), "type");
            form.Add(new StringContent(DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(5)).ToString("yyyy-MM-dd")), "requestDate");
            form.Add(new StringContent("Portal test request"), "reason");

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/employees/{employeeId}/requests")
            {
                Content = form,
            };
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();
            var created = await response.Content.ReadFromJsonAsync<JsonElement>();
            return created.GetProperty("id").GetInt32();
        }

        private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, object? body, string token)
        {
            var request = _fixture.AuthorizedRequest(method, path, body, token);
            return await _fixture.Client.SendAsync(request);
        }

        private async Task<JsonElement> GetJsonAsync(string path, string token)
        {
            var response = await SendAsync(HttpMethod.Get, path, null, token);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }

        /// <summary>Omar's token scoped to gym2, where he is Team Leader.</summary>
        private async Task<string> LoginOmarAtGym2Async()
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "omar@revive.hr",
                password = "Revive!2026",
            });
            login.EnsureSuccessStatusCode();
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(loginBody.GetProperty("requiresGymSelection").GetBoolean());

            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new
            {
                gymId = await Gym2IdAsync(),
                tempSessionToken = loginBody.GetProperty("tempSessionToken").GetString(),
            });
            select.EnsureSuccessStatusCode();
            var selectBody = await select.Content.ReadFromJsonAsync<JsonElement>();
            return selectBody.GetProperty("accessToken").GetString()!;
        }

        /// <summary>Omar's token scoped to gym1, where he is Branch Manager.</summary>
        private async Task<string> LoginOmarAtGym1Async()
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "omar@revive.hr",
                password = "Revive!2026",
            });
            login.EnsureSuccessStatusCode();
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(loginBody.GetProperty("requiresGymSelection").GetBoolean());

            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new
            {
                gymId = await Gym1IdAsync(),
                tempSessionToken = loginBody.GetProperty("tempSessionToken").GetString(),
            });
            select.EnsureSuccessStatusCode();
            var selectBody = await select.Content.ReadFromJsonAsync<JsonElement>();
            return selectBody.GetProperty("accessToken").GetString()!;
        }

        private async Task<int> Gym1IdAsync()
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == "Revive Main Gym").Select(g => g.Id).SingleAsync();
        }

        private async Task<int> Gym2IdAsync()
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == "Revive Second Gym").Select(g => g.Id).SingleAsync();
        }
    }
}
