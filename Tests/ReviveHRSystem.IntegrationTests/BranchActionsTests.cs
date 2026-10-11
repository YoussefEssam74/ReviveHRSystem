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
                note = "Absent with no prior notice"
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
        public async Task Actions_PlainEmployee_Returns403()
        {
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/branch-actions/pending-hr", null, token));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
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
