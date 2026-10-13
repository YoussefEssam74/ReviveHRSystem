using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.Web.DataSeed;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Pagination contract for the list endpoints: the documented
    /// <c>{ items, page, pageSize, totalCount, totalPages }</c> envelope, page/step
    /// maths, and the clamping guards that stop a malformed query from producing a
    /// negative <c>Skip</c> or an empty page.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class PaginationTests
    {
        private readonly ApiTestFixture _fixture;

        public PaginationTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Directory_DefaultPage_IsEnvelope_NotBareArray()
        {
            var token = await LoginBranchManagerGym1Async();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees", null, token);
            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(JsonValueKind.Object, body.ValueKind);

            var total = body.GetProperty("totalCount").GetInt32();
            Assert.True(total > 0, "The gym-1 roster is seeded, so totalCount must be positive.");

            // Defaults: page 1, page size 10, totalPages covers the whole roster.
            Assert.Equal(1, body.GetProperty("page").GetInt32());
            Assert.Equal(10, body.GetProperty("pageSize").GetInt32());
            Assert.Equal(
                (int)Math.Ceiling(total / 10.0),
                body.GetProperty("totalPages").GetInt32());

            // The page holds at most pageSize items even when more rows exist.
            Assert.True(body.GetProperty("items").GetArrayLength() <= 10);
        }

        [Fact]
        public async Task Directory_Page2_ReturnsTheSecondSlice()
        {
            var token = await LoginBranchManagerGym1Async();

            // Total roster size is not the contract under test, only that page 2 is a
            // different, non-overlapping slice of page 1. Sort by name so the ordering
            // does not depend on insertion order or on other suites' seeded employees.
            var page1 = await GetEnvelopeAsync("/api/employees?pageSize=1&sortBy=name", token);
            var page2 = await GetEnvelopeAsync("/api/employees?pageNumber=2&pageSize=1&sortBy=name", token);

            var first = page1.GetProperty("items")[0].GetProperty("name").GetString();
            var second = page2.GetProperty("items")[0].GetProperty("name").GetString();

            Assert.NotEqual(first, second);
            Assert.Equal(2, page2.GetProperty("page").GetInt32());

            // Both pages belong to the same ordered set, so the second name sorts after
            // the first — proof the sequence is contiguous rather than arbitrary.
            Assert.True(string.Compare(second, first, StringComparison.OrdinalIgnoreCase) > 0);
        }

        [Fact]
        public async Task Directory_PageBeyondLast_ReturnsEmptyItems_ButKeepsTotalCount()
        {
            var token = await LoginBranchManagerGym1Async();

            var body = await GetEnvelopeAsync("/api/employees?pageNumber=9999&pageSize=10", token);

            Assert.Empty(body.GetProperty("items").EnumerateArray());
            Assert.True(body.GetProperty("totalCount").GetInt32() > 0);
        }

        [Fact]
        public async Task Directory_NegativePageNumber_IsReadBackAsOne()
        {
            var token = await LoginBranchManagerGym1Async();

            var body = await GetEnvelopeAsync("/api/employees?pageNumber=0&pageSize=10", token);

            Assert.Equal(1, body.GetProperty("page").GetInt32());
            Assert.NotEmpty(body.GetProperty("items").EnumerateArray());
        }

        [Fact]
        public async Task Directory_ZeroPageSize_FallsBackToDefault()
        {
            var token = await LoginBranchManagerGym1Async();

            var body = await GetEnvelopeAsync("/api/employees?pageSize=0", token);

            Assert.Equal(10, body.GetProperty("pageSize").GetInt32());
            Assert.NotEmpty(body.GetProperty("items").EnumerateArray());
        }

        [Fact]
        public async Task Directory_ExcessivePageSize_IsClampedToMaximum()
        {
            var token = await LoginBranchManagerGym1Async();

            var body = await GetEnvelopeAsync("/api/employees?pageSize=100000", token);

            Assert.Equal(100, body.GetProperty("pageSize").GetInt32());
        }

        [Fact]
        public async Task Directory_ExtremePageNumber_DoesNotOverflowTheSkip()
        {
            // An extreme pageNumber used to overflow (pageNumber-1)*pageSize into a
            // negative Skip, which Enumerable.Skip rejects with a 500. It must instead
            // read as a page past the end: empty items, intact totalCount.
            var token = await LoginBranchManagerGym1Async();

            var body = await GetEnvelopeAsync("/api/employees?pageNumber=2147483647&pageSize=100", token);

            Assert.Empty(body.GetProperty("items").EnumerateArray());
            Assert.True(body.GetProperty("totalCount").GetInt32() > 0);
        }

        [Fact]
        public async Task Directory_FiltersNarrowTheResult()
        {
            var token = await LoginBranchManagerGym1Async();

            var byName = await GetEnvelopeAsync("/api/employees?q=Karim", token);
            Assert.All(
                byName.GetProperty("items").EnumerateArray(),
                e => Assert.Contains("Karim", e.GetProperty("name").GetString()!));

            // An unmatched status matches nothing, so totalCount collapses to zero.
            var byStatus = await GetEnvelopeAsync("/api/employees?status=Archived", token);
            Assert.Equal(0, byStatus.GetProperty("totalCount").GetInt32());
        }

        [Fact]
        public async Task RequestInbox_UsesTheSameEnvelope()
        {
            // The requests inbox reuses the same envelope, and paging applies after
            // filtering so totalCount reflects the filtered set, not the raw table.
            var token = await LoginBranchManagerGym1Async();

            var body = await GetEnvelopeAsync("/api/requests", token);

            Assert.Equal(1, body.GetProperty("page").GetInt32());
            Assert.Equal(10, body.GetProperty("pageSize").GetInt32());

            var totalCount = body.GetProperty("totalCount").GetInt32();
            Assert.Equal(Math.Min(totalCount, 10), body.GetProperty("items").GetArrayLength());
        }

        [Fact]
        public async Task Attendance_DateRange_AddsPagedRoster()
        {
            var token = await LoginBranchManagerGym1Async();
            var from = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-2);
            var to = DateOnly.FromDateTime(DateTime.UtcNow);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get,
                $"/api/attendance?dateFrom={from:yyyy-MM-dd}&dateTo={to:yyyy-MM-dd}&pageSize=100",
                null,
                token);
            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(JsonValueKind.Object, body.ValueKind);

            // The roster covers every in-scope person-day across the window.
            Assert.Equal(from.ToString("yyyy-MM-dd"), body.GetProperty("dateFrom").GetString());
            Assert.Equal(to.ToString("yyyy-MM-dd"), body.GetProperty("dateTo").GetString());

            var roster = body.GetProperty("roster");
            Assert.Equal(100, roster.GetProperty("pageSize").GetInt32());
            Assert.True(roster.GetProperty("totalCount").GetInt32() > 0);

            // Every row carries its day so the UI can group the range.
            Assert.All(
                roster.GetProperty("items").EnumerateArray(),
                e => Assert.False(string.IsNullOrWhiteSpace(e.GetProperty("date").GetString())));
        }

        [Fact]
        public async Task Attendance_RangeBeyondTheCap_Returns400()
        {
            // An unbounded date range once materialised every person-day of the scope
            // into memory before paging, so a full-range request could exhaust the host.
            var token = await LoginBranchManagerGym1Async();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get,
                "/api/attendance?dateFrom=0001-01-01&dateTo=9999-12-31",
                null,
                token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Attendance_ReversedRange_IsSwapped_NotRejected()
        {
            var token = await LoginBranchManagerGym1Async();
            var from = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-3);
            var to = DateOnly.FromDateTime(DateTime.UtcNow);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get,
                $"/api/attendance?dateFrom={to:yyyy-MM-dd}&dateTo={from:yyyy-MM-dd}&pageSize=100",
                null,
                token);
            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(from.ToString("yyyy-MM-dd"), body.GetProperty("dateFrom").GetString());
            Assert.Equal(to.ToString("yyyy-MM-dd"), body.GetProperty("dateTo").GetString());
        }

        [Fact]
        public async Task Notifications_Unauthenticated_Still401()
        {
            var response = await _fixture.Client.GetAsync("/api/notifications");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ---------- helpers ----------

        private async Task<JsonElement> GetEnvelopeAsync(string url, string token)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, url, null, token);
            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }

        private async Task<string> LoginBranchManagerGym1Async()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "omar@revive.hr",
                password = "Revive!2026"
            });
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            var temp = loginBody.GetProperty("tempSessionToken").GetString()!;

            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new
            {
                gymId = gym1Id,
                tempSessionToken = temp
            });
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
    }
}
