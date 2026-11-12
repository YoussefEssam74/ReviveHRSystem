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
    /// Branch Actions (mock §20): deductions, warning notices and bonus proposals
    /// raised for HR (all Pending), the manager's "Awaiting HR" queue, and the
    /// free-form branch report. Scope + feature gates apply; cross-gym targets 404.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class BranchActionsTests
    {
        private readonly ApiTestFixture _fixture;

        public BranchActionsTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Deduction_Issue_ShowsInHrQueue()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");

            var issue = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/deduction-candidates", new
            {
                employeeId = karimId,
                amount = 150m,
                reason = "Unapproved absence",
                note = "Absent with no prior notice",
                date = await FreeDeductionDateAsync(karimId)
            }, token);
            var issueResponse = await _fixture.Client.SendAsync(issue);
            issueResponse.EnsureSuccessStatusCode();
            var created = await issueResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Pending", created.GetProperty("status").GetString());
            Assert.Equal("Karim Hassan", created.GetProperty("employee").GetString());

            var queue = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/branch-actions/pending-hr", null, token);
            var queueResponse = await _fixture.Client.SendAsync(queue);
            queueResponse.EnsureSuccessStatusCode();
            var queueBody = await queueResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(queueBody.EnumerateArray(), i =>
                i.GetProperty("kind").GetString() == "Deduction"
                && i.GetProperty("employee").GetString() == "Karim Hassan"
                && i.GetProperty("status").GetString() == "Pending HR");
        }

        [Fact]
        public async Task Warning_Issue_UnknownCategory_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");

            var issue = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/warning-notices", new
            {
                employeeId = karimId,
                type = "Not A Category",
                reason = "Whatever"
            }, token);
            var response = await _fixture.Client.SendAsync(issue);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Warning_Issue_Valid_ShowsInHrQueue()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");

            var issue = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/warning-notices", new
            {
                employeeId = karimId,
                type = "Attendance",
                reason = "3rd late arrival within one month",
                note = "Verbal warning issued on site"
            }, token);
            var issueResponse = await _fixture.Client.SendAsync(issue);
            issueResponse.EnsureSuccessStatusCode();

            var queue = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/branch-actions/pending-hr", null, token);
            var queueResponse = await _fixture.Client.SendAsync(queue);
            var queueBody = await queueResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(queueBody.EnumerateArray(), i => i.GetProperty("kind").GetString() == "Warning");
        }

        [Fact]
        public async Task Bonus_Propose_WithoutAmount_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");

            var propose = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/bonus-proposals", new
            {
                employeeId = karimId,
                type = "Performance Bonus",
                amount = 0m,
                reason = "Great quarter"
            }, token);
            var response = await _fixture.Client.SendAsync(propose);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Bonus_Propose_Valid_ShowsInHrQueue()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");

            var propose = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/bonus-proposals", new
            {
                employeeId = karimId,
                type = "Performance Bonus",
                amount = 500m,
                reason = "Covered extra classes during event week",
                note = "Branch revenue up 12%"
            }, token);
            var proposeResponse = await _fixture.Client.SendAsync(propose);
            proposeResponse.EnsureSuccessStatusCode();

            var queue = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/branch-actions/pending-hr", null, token);
            var queueResponse = await _fixture.Client.SendAsync(queue);
            var queueBody = await queueResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(queueBody.EnumerateArray(), i =>
                i.GetProperty("kind").GetString() == "Bonus"
                && i.GetProperty("detail").GetString()!.Contains("EGP 500"));
        }

        [Fact]
        public async Task Deduction_CrossGymEmployee_Returns404()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");

            var issue = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/deduction-candidates", new
            {
                employeeId = saraId,
                amount = 100m,
                reason = "Unapproved absence"
            }, token);
            var response = await _fixture.Client.SendAsync(issue);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Deduction_BranchReview_ApproveThenReprice_KeepsOpenForHr()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");

            var candidateId = await IssueDeductionAndGetIdAsync(token, karimId, 120m, "Branch review approve test");

            var approve = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/deduction-candidates/{candidateId}/branch-review", new
            {
                decision = "approve"
            }, token);
            var approveResponse = await _fixture.Client.SendAsync(approve);
            approveResponse.EnsureSuccessStatusCode();
            var approved = await approveResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("BranchApproved", approved.GetProperty("status").GetString());
            Assert.Equal(120m, approved.GetProperty("amount").GetDecimal());

            // edit travelled together with approve — 150 EGP
            var edit = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/deduction-candidates/{candidateId}/branch-review", new
            {
                decision = "approve",
                amount = 150m
            }, token);
            var editResponse = await _fixture.Client.SendAsync(edit);
            editResponse.EnsureSuccessStatusCode();
            var repriced = await editResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("BranchApproved", repriced.GetProperty("status").GetString());
            Assert.Equal(150m, repriced.GetProperty("amount").GetDecimal());
        }

        [Fact]
        public async Task Deduction_BranchReview_RejectOnlyAmountChange_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");

            var candidateId = await IssueDeductionAndGetIdAsync(token, karimId, 80m, "Branch review reprice test");

            var edit = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/deduction-candidates/{candidateId}/branch-review", new
            {
                decision = "edit"
            }, token);
            var editResponse = await _fixture.Client.SendAsync(edit);

            Assert.Equal(HttpStatusCode.BadRequest, editResponse.StatusCode);
        }

        [Fact]
        public async Task Deduction_BranchReview_RejectIsFinal_SecondDecisionReturns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");

            var candidateId = await IssueDeductionAndGetIdAsync(token, karimId, 60m, "Branch review reject test");

            var reject = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/deduction-candidates/{candidateId}/branch-review", new
            {
                decision = "reject"
            }, token);
            var rejectResponse = await _fixture.Client.SendAsync(reject);
            rejectResponse.EnsureSuccessStatusCode();
            var rejected = await rejectResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Rejected", rejected.GetProperty("status").GetString());

            var second = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/deduction-candidates/{candidateId}/branch-review", new
            {
                decision = "approve"
            }, token);
            var secondResponse = await _fixture.Client.SendAsync(second);

            Assert.Equal(HttpStatusCode.BadRequest, secondResponse.StatusCode);
        }

        [Fact]
        public async Task Deduction_BranchReview_PlainEmployee_Returns404()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");

            var candidateId = await IssueDeductionAndGetIdAsync(token, karimId, 40m, "Branch review scope test");

            var karimToken = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var acting = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/deduction-candidates/{candidateId}/branch-review", new
            {
                decision = "approve"
            }, karimToken);
            var actingResponse = await _fixture.Client.SendAsync(acting);

            // A non-manager answers exactly like the row never existed.
            Assert.Equal(HttpStatusCode.NotFound, actingResponse.StatusCode);
        }

        /// <summary>Issues a deduction as the active manager and returns the created candidate id.</summary>
        private async Task<int> IssueDeductionAndGetIdAsync(
            string token, int employeeId, decimal amount, string note, string? date = null)
        {
            var issue = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/deduction-candidates", new
            {
                employeeId,
                amount,
                reason = "Unapproved absence",
                note,
                date = date ?? await FreeDeductionDateAsync(employeeId)
            }, token);
            var issueResponse = await _fixture.Client.SendAsync(issue);
            issueResponse.EnsureSuccessStatusCode();
            var created = await issueResponse.Content.ReadFromJsonAsync<JsonElement>();
            return created.GetProperty("id").GetInt32();
        }

        /// <summary>
        /// One deduction per employee/day, so every issue in this class needs a day of
        /// its own: the nearest earlier day the employee has no deduction on yet.
        /// </summary>
        private async Task<string> FreeDeductionDateAsync(int employeeId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var taken = await db.DeductionCandidates
                .Where(c => c.EmployeeId == employeeId)
                .Select(c => c.DeductionDate)
                .ToListAsync();

            var today = DateOnly.FromDateTime(DateTime.Today);
            for (var offset = 1; offset <= 180; offset++)
            {
                var date = today.AddDays(-offset);
                if (!taken.Contains(date))
                {
                    return date.ToString("yyyy-MM-dd");
                }
            }

            throw new InvalidOperationException($"No free deduction date left for employee {employeeId}.");
        }

        /// <summary>
        /// A rejected day is final for the branch too: re-issuing the same day is
        /// refused instead of quietly reviving a waived deduction.
        /// </summary>
        [Fact]
        public async Task Deduction_Issue_OnRejectedDay_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var karimId = await OwnEmployeeIdAsync("karim@revive.hr");
            var date = await FreeDeductionDateAsync(karimId);
            var candidateId = await IssueDeductionAndGetIdAsync(token, karimId, 90m, "Rejected day re-issue test", date);

            var reject = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/deduction-candidates/{candidateId}/branch-review", new
            {
                decision = "reject"
            }, token);
            Assert.Equal(HttpStatusCode.OK, (await _fixture.Client.SendAsync(reject)).StatusCode);

            var again = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/deduction-candidates", new
            {
                employeeId = karimId,
                amount = 90m,
                reason = "Unapproved absence",
                note = "Second attempt on the rejected day",
                date
            }, token);
            Assert.Equal(HttpStatusCode.BadRequest, (await _fixture.Client.SendAsync(again)).StatusCode);
        }

        [Fact]
        public async Task BranchReport_AnyEmployee_LandsInHrQueue()
        {
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var send = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/branch-reports", new
            {
                period = "August 2026",
                type = "Attendance exceptions",
                message = "Two trainers repeatedly late this month."
            }, token);
            var sendResponse = await _fixture.Client.SendAsync(send);

            Assert.Equal(HttpStatusCode.NoContent, sendResponse.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var report = await db.Events.FirstOrDefaultAsync(e =>
                e.Type == DomainLayer.Models.NotificationModule.Enums.EventType.BranchReport
                && e.GymId == gymId
                && e.Title.Contains("Attendance exceptions"));
            Assert.NotNull(report);
            Assert.Contains("Two trainers", report!.Description);
        }

        [Fact]
        public async Task BranchReport_UnknownType_Returns400()
        {
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var send = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/branch-reports", new
            {
                type = "Nonsense",
                message = "Hello"
            }, token);
            var response = await _fixture.Client.SendAsync(send);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
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

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }
    }
}
