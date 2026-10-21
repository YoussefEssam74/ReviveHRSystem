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
    /// Pagination contract for the HR-portal list endpoints: the documented
    /// <c>{ items, page, pageSize, total, totalPages }</c> envelope, page/step
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
            var (token, gym1Id) = await LoginAdminWithGym1Async();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees?gym={gym1Id}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(JsonValueKind.Object, body.ValueKind);

            var total = body.GetProperty("total").GetInt32();
            Assert.True(total > 0, "The gym-1 roster is seeded, so total must be positive.");

            // Defaults: page 1, page size 20, totalPages covers the whole roster.
            Assert.Equal(1, body.GetProperty("page").GetInt32());
            Assert.Equal(20, body.GetProperty("pageSize").GetInt32());
            Assert.Equal(
                (int)Math.Ceiling(total / 20.0),
                body.GetProperty("totalPages").GetInt32());

            // The page holds at most pageSize items even when more rows exist.
            Assert.True(body.GetProperty("items").GetArrayLength() <= 20);
        }

        [Fact]
        public async Task Directory_Page2_ReturnsTheSecondSlice()
        {
            var (token, gym1Id) = await LoginAdminWithGym1Async();

            // Total roster size is not the contract under test, only that page 2 is a
            // different, non-overlapping slice of page 1. Sort by name so the ordering
            // does not depend on insertion order or on other suites' seeded employees.
            var page1 = await GetEnvelopeAsync($"/api/employees?gym={gym1Id}&pageSize=1&sortBy=name", token);
            var page2 = await GetEnvelopeAsync($"/api/employees?gym={gym1Id}&page=2&pageSize=1&sortBy=name", token);

            var first = page1.GetProperty("items")[0].GetProperty("name").GetString();
            var second = page2.GetProperty("items")[0].GetProperty("name").GetString();

            Assert.NotEqual(first, second);
            Assert.Equal(2, page2.GetProperty("page").GetInt32());

            // Both pages belong to the same ordered set, so the second name sorts after
            // the first — proof the sequence is contiguous rather than arbitrary.
            Assert.True(string.Compare(second, first, StringComparison.OrdinalIgnoreCase) > 0);
        }

        [Fact]
        public async Task Directory_PageBeyondLast_ReturnsEmptyItems_ButKeepsTotal()
        {
            var (token, gym1Id) = await LoginAdminWithGym1Async();

            var body = await GetEnvelopeAsync($"/api/employees?gym={gym1Id}&page=9999&pageSize=10", token);

            Assert.Empty(body.GetProperty("items").EnumerateArray());
            Assert.True(body.GetProperty("total").GetInt32() > 0);
        }

        [Fact]
        public async Task Directory_NegativePageNumber_IsReadBackAsOne()
        {
            var (token, gym1Id) = await LoginAdminWithGym1Async();

            var body = await GetEnvelopeAsync($"/api/employees?gym={gym1Id}&page=0&pageSize=10", token);

            Assert.Equal(1, body.GetProperty("page").GetInt32());
            Assert.NotEmpty(body.GetProperty("items").EnumerateArray());
        }

        [Fact]
        public async Task Directory_ZeroPageSize_FallsBackToDefault()
        {
            var (token, gym1Id) = await LoginAdminWithGym1Async();

            var body = await GetEnvelopeAsync($"/api/employees?gym={gym1Id}&pageSize=0", token);

            Assert.Equal(20, body.GetProperty("pageSize").GetInt32());
            Assert.NotEmpty(body.GetProperty("items").EnumerateArray());
        }

        [Fact]
        public async Task Directory_ExcessivePageSize_IsClampedToMaximum()
        {
            var (token, gym1Id) = await LoginAdminWithGym1Async();

            var body = await GetEnvelopeAsync($"/api/employees?gym={gym1Id}&pageSize=100000", token);

            Assert.Equal(100, body.GetProperty("pageSize").GetInt32());
        }

        [Fact]
        public async Task Directory_ExtremePageNumber_DoesNotOverflowTheSkip()
        {
            // An extreme page number must read as a page past the end — empty items and
            // an intact total — never as a negative Skip that Enumerable.Skip rejects.
            var (token, gym1Id) = await LoginAdminWithGym1Async();

            var body = await GetEnvelopeAsync($"/api/employees?gym={gym1Id}&page=1000000&pageSize=100", token);

            Assert.Empty(body.GetProperty("items").EnumerateArray());
            Assert.True(body.GetProperty("total").GetInt32() > 0);
        }

        [Fact]
        public async Task Directory_FiltersNarrowTheResult()
        {
            var (token, gym1Id) = await LoginAdminWithGym1Async();

            var byName = await GetEnvelopeAsync($"/api/employees?gym={gym1Id}&search=Karim", token);
            Assert.All(
                byName.GetProperty("items").EnumerateArray(),
                e => Assert.Contains("Karim", e.GetProperty("name").GetString()!));

            // A search that matches nobody collapses the total to zero.
            var bySearch = await GetEnvelopeAsync($"/api/employees?gym={gym1Id}&search=Zorblatt", token);
            Assert.Equal(0, bySearch.GetProperty("total").GetInt32());
        }

        [Fact]
        public async Task RequestInbox_UsesTheSameEnvelope()
        {
            // The requests inbox reuses the same envelope, and paging applies after
            // filtering so total reflects the filtered set, not the raw table.
            var (token, gym1Id) = await LoginAdminWithGym1Async();

            var body = await GetEnvelopeAsync($"/api/requests?gym={gym1Id}", token);

            Assert.Equal(1, body.GetProperty("page").GetInt32());
            Assert.Equal(20, body.GetProperty("pageSize").GetInt32());

            var total = body.GetProperty("total").GetInt32();
            Assert.Equal(Math.Min(total, 20), body.GetProperty("items").GetArrayLength());
        }

        [Fact]
        public async Task Attendance_DateRange_AddsPagedGrid()
        {
            var (token, gym1Id) = await LoginAdminWithGym1Async();
            var from = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-2);
            var to = DateOnly.FromDateTime(DateTime.UtcNow);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get,
                $"/api/attendance?gym={gym1Id}&from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}&pageSize=100",
                null,
                token);
            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(JsonValueKind.Object, body.ValueKind);

            // The grid covers every in-scope person-day across the window.
            Assert.Equal(100, body.GetProperty("pageSize").GetInt32());
            Assert.True(body.GetProperty("total").GetInt32() > 0);

            // Every row carries its day so the UI can group the range.
            Assert.All(
                body.GetProperty("items").EnumerateArray(),
                e => Assert.False(string.IsNullOrWhiteSpace(e.GetProperty("date").GetString())));
        }

        [Fact]
        public async Task Attendance_RangeBeyondTheCap_Returns400()
        {
            // An unbounded date range once materialised every person-day of the scope
            // into memory before paging, so a full-range request could exhaust the host.
            var (token, gym1Id) = await LoginAdminWithGym1Async();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get,
                $"/api/attendance?gym={gym1Id}&from=0001-01-01&to=9999-12-31",
                null,
                token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Attendance_ReversedRange_IsRejected()
        {
            var (token, gym1Id) = await LoginAdminWithGym1Async();
            var from = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-3);
            var to = DateOnly.FromDateTime(DateTime.UtcNow);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get,
                $"/api/attendance?gym={gym1Id}&from={to:yyyy-MM-dd}&to={from:yyyy-MM-dd}&pageSize=100",
                null,
                token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
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

        /// <summary>
        /// The HR-portal guards check flat permission keys (attendance.view, …) that the
        /// seeded preset roles do not carry, so these tests authenticate as the seeded
        /// Top Management account (which bypasses permission checks per ADR-003) and
        /// scope by gym in the query string.
        /// </summary>
        private async Task<(string Token, int Gym1Id)> LoginAdminWithGym1Async()
        {
            var token = await _fixture.GetAdminTokenAsync();
            return (token, await Gym1IdAsync());
        }

        private async Task<int> Gym1IdAsync() => await GymIdByNameAsync("Revive Main Gym");

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }
    }
}
