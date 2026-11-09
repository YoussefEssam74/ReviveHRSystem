using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.PayrollModule;
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
    /// The four endpoints added for the HR/HR-Manager screens:
    /// GET /api/users (HR Team list), the warning/bonus review queues
    /// (GET + POST {id}/review), GET /api/dashboard/hr and
    /// GET /api/reports/overview. All are gated per ADR-003 inside the services.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class HrPortalAggregateTests
    {
        private readonly ApiTestFixture _fixture;

        public HrPortalAggregateTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        private async Task<JsonElement> GetAsync(string url, string token)
        {
            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(HttpMethod.Get, url, null, token));
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from {url} but got {(int)response.StatusCode}: {body}");
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body, string token)
            => await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(method, url, body, token));

        // ==================================================================
        // GET /api/users — HR Team member list
        // ==================================================================

        [Fact]
        public async Task Users_List_WithTeamView_ReturnsStaffMembers()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "team.view");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var body = await GetAsync("/api/users", token);

            Assert.True(body.TryGetProperty("items", out var items));
            Assert.True(items.GetArrayLength() > 0);
            var first = items[0];
            Assert.Equal(JsonValueKind.Object, first.ValueKind);
            Assert.False(string.IsNullOrEmpty(first.GetProperty("name").GetString()));
            Assert.False(string.IsNullOrEmpty(first.GetProperty("status").GetString()));
            // Staff-only default: no plain employee accounts in the HR Team list.
            foreach (var item in items.EnumerateArray())
            {
                Assert.DoesNotContain("Employee", item.GetProperty("role").GetString() ?? string.Empty);
            }
        }

        [Fact]
        public async Task Users_List_WithoutTeamView_Returns403()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var response = await SendAsync(HttpMethod.Get, "/api/users", null, token);

            // Permission denials surface as 401 in this codebase (UnAuthorizedException).
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Users_List_SearchNarrowsResults()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "team.view");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var body = await GetAsync($"/api/users?search={Uri.EscapeDataString(hr.Email)}", token);

            Assert.True(body.TryGetProperty("items", out var items));
            Assert.All(items.EnumerateArray(), item =>
                Assert.Contains(hr.Email, item.GetProperty("email").GetString(), StringComparison.OrdinalIgnoreCase));
        }

        // ==================================================================
        // Warning notices / bonus proposals — HR review
        // ==================================================================

        private async Task<(int NoticeId, TestGym Gym)> CreatePendingNoticeAsync()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var issuer = await builder.CreateUserAsync(UserType.HR, new[] { gym });

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var notice = new WarningNotice
            {
                EmployeeId = employee.EmployeeId,
                Type = "Conduct",
                Reason = "Repeated tardiness",
                Note = "Issued by branch manager",
                IssuedBy = issuer.UserId,
                Status = ProposalStatus.Pending,
            };
            db.WarningNotices.Add(notice);
            await db.SaveChangesAsync();
            return (notice.Id, gym);
        }

        private async Task<(int ProposalId, TestGym Gym)> CreatePendingBonusAsync()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var issuer = await builder.CreateUserAsync(UserType.HR, new[] { gym });

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var proposal = new BonusProposal
            {
                EmployeeId = employee.EmployeeId,
                Type = "Performance",
                Amount = 500m,
                Reason = "Exceeded targets",
                IssuedBy = issuer.UserId,
                Status = ProposalStatus.Pending,
            };
            db.BonusProposals.Add(proposal);
            await db.SaveChangesAsync();
            return (proposal.Id, gym);
        }

        private async Task<string> HrTokenWithAsync(TestGym gym, params string[] keys)
        {
            var builder = NewBuilder();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            foreach (var key in keys)
            {
                await builder.GrantPermissionAsync(hr.UserId, key);
            }

            return await _fixture.LoginAsync(hr.Email, hr.Password);
        }

        [Fact]
        public async Task Warning_List_WithRequestsView_ReturnsPendingItem()
        {
            var (noticeId, gym) = await CreatePendingNoticeAsync();
            var token = await HrTokenWithAsync(gym, "requests.view");

            var body = await GetAsync("/api/warning-notices/queue?status=Pending", token);

            Assert.True(body.TryGetProperty("items", out var items));
            Assert.Contains(items.EnumerateArray(), i => i.GetProperty("id").GetInt32() == noticeId);
        }

        [Fact]
        public async Task Warning_Review_Approve_StampsWithReviewer()
        {
            var (noticeId, gym) = await CreatePendingNoticeAsync();
            var token = await HrTokenWithAsync(gym, "requests.view", "requests.approve");

            var response = await SendAsync(HttpMethod.Post, $"/api/warning-notices/{noticeId}/review",
                new { decision = "Approved", note = "Filed to employee record." }, token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());
            var data = body.GetProperty("data");
            Assert.Equal("Approved", data.GetProperty("status").GetString());
            Assert.NotNull(data.GetProperty("reviewedAt").GetString());
            Assert.False(string.IsNullOrEmpty(data.GetProperty("reviewedBy").GetString()));
        }

        [Fact]
        public async Task Warning_Review_DeclineWithoutReason_Returns400()
        {
            var (noticeId, gym) = await CreatePendingNoticeAsync();
            var token = await HrTokenWithAsync(gym, "requests.approve");

            var response = await SendAsync(HttpMethod.Post, $"/api/warning-notices/{noticeId}/review",
                new { decision = "Rejected" }, token);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Warning_Review_Twice_Returns400()
        {
            var (noticeId, gym) = await CreatePendingNoticeAsync();
            var token = await HrTokenWithAsync(gym, "requests.approve");

            var first = await SendAsync(HttpMethod.Post, $"/api/warning-notices/{noticeId}/review",
                new { decision = "Approved" }, token);
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);

            var second = await SendAsync(HttpMethod.Post, $"/api/warning-notices/{noticeId}/review",
                new { decision = "Rejected", note = "Changed my mind." }, token);
            Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        }

        [Fact]
        public async Task Warning_Review_WithoutPermission_Returns403()
        {
            var (noticeId, gym) = await CreatePendingNoticeAsync();
            var token = await HrTokenWithAsync(gym, "requests.view");

            var response = await SendAsync(HttpMethod.Post, $"/api/warning-notices/{noticeId}/review",
                new { decision = "Approved" }, token);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Bonus_Review_DeclineWithReason_MarksRejected()
        {
            var (proposalId, gym) = await CreatePendingBonusAsync();
            var token = await HrTokenWithAsync(gym, "requests.view", "requests.approve");

            var response = await SendAsync(HttpMethod.Post, $"/api/bonus-proposals/{proposalId}/review",
                new { decision = "Rejected", note = "Outside budget." }, token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());
            var data = body.GetProperty("data");
            Assert.Equal("Rejected", data.GetProperty("status").GetString());
            Assert.Equal("Outside budget.", data.GetProperty("reviewNote").GetString());
        }

        [Fact]
        public async Task Bonus_List_WithRequestsView_ReturnsPendingItem()
        {
            var (proposalId, gym) = await CreatePendingBonusAsync();
            var token = await HrTokenWithAsync(gym, "requests.view");

            var body = await GetAsync("/api/bonus-proposals/queue?status=Pending", token);

            Assert.True(body.TryGetProperty("items", out var items));
            Assert.Contains(items.EnumerateArray(), i => i.GetProperty("id").GetInt32() == proposalId);
        }

        // ==================================================================
        // GET /api/dashboard/hr
        // ==================================================================

        [Fact]
        public async Task HrDashboard_ReturnsKpisActionsAndBranches()
        {
            var (noticeId, gym) = await CreatePendingNoticeAsync();
            _ = noticeId;
            var token = await HrTokenWithAsync(gym, "requests.view");

            var body = await GetAsync("/api/dashboard/hr", token);

            var kpis = body.GetProperty("kpis");
            Assert.True(kpis.GetProperty("totalGyms").GetInt32() >= 1);
            Assert.True(kpis.GetProperty("totalStaff").GetInt32() >= 1);
            Assert.True(kpis.GetProperty("actionsNeeded").GetInt32() >= 1);

            Assert.True(body.TryGetProperty("actions", out var actions));
            Assert.Contains(actions.EnumerateArray(), a => a.GetProperty("kind").GetString() == "warning");

            Assert.True(body.TryGetProperty("branches", out var branches));
            Assert.Contains(branches.EnumerateArray(), b => b.GetProperty("gymId").GetInt32() == gym.GymId);
        }

        [Fact]
        public async Task HrDashboard_PermissionGatesHideCards()
        {
            var (_, gym) = await CreatePendingNoticeAsync();
            var token = await HrTokenWithAsync(gym); // no permission keys at all

            var body = await GetAsync("/api/dashboard/hr", token);

            // The dashboard itself is open, but the warning card needs requests.view.
            Assert.Equal(0, body.GetProperty("kpis").GetProperty("actionsNeeded").GetInt32());
        }

        // ==================================================================
        // GET /api/reports/overview
        // ==================================================================

        [Fact]
        public async Task ReportsOverview_WithReportsView_ReturnsSections()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "reports.view");
            await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var body = await GetAsync("/api/reports/overview?period=30d", token);

            Assert.Equal("30d", body.GetProperty("period").GetString());
            Assert.True(body.GetProperty("workforce").GetProperty("totalEmployees").GetInt32() >= 1);
            Assert.True(body.TryGetProperty("attendance", out _));
            Assert.True(body.TryGetProperty("requests", out _));
            Assert.True(body.TryGetProperty("recruiting", out _));
            Assert.True(body.TryGetProperty("payroll", out _));
            Assert.True(body.TryGetProperty("offboarding", out _));
        }

        [Fact]
        public async Task ReportsOverview_WithoutReportsView_Returns403()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var response = await SendAsync(HttpMethod.Get, "/api/reports/overview", null, token);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }
}
