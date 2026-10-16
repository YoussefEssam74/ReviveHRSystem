using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// The kiosk dashboard data endpoint: today's counters and recent feed for the
    /// station's gym, authenticated by the station session.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class StationSummaryControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public StationSummaryControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        [Fact]
        public async Task Summary_StationSession_ReturnsGymsTodayData()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            // One check-in today: present 1, scheduled 1 (the employee's shift).
            var punch = _fixture.StationRequest(HttpMethod.Post, "/api/attendance/events", new
            {
                employeeId = employee.EmployeeNumber,
                type = "IN",
                livenessScore = 0.95,
            }, stationToken);
            var punchResponse = await _fixture.Client.SendAsync(punch);
            Assert.Equal(HttpStatusCode.Created, punchResponse.StatusCode);

            var request = _fixture.StationRequest(HttpMethod.Get, "/api/attendance/station-summary", null, stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(body.GetProperty("presentCount").GetInt32() >= 1);
            Assert.True(body.GetProperty("scheduledTodayCount").GetInt32() >= 1);

            var records = body.GetProperty("records").EnumerateArray().ToArray();
            Assert.Contains(records, r => r.GetProperty("employeeId").GetString() == employee.EmployeeNumber);
            var row = records.First(r => r.GetProperty("employeeId").GetString() == employee.EmployeeNumber);
            Assert.Equal("PRESENT", row.GetProperty("status").GetString());
            Assert.Equal("IN", row.GetProperty("lastEventType").GetString());
        }

        [Fact]
        public async Task Summary_WithoutStationToken_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/attendance/station-summary");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Summary_ScopedToTheSessionsGym()
        {
            var builder = NewBuilder();
            var homeGym = await builder.CreateGymWithStationAsync();
            var otherGym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(homeGym, shiftAtGym: homeGym);
            var otherStationToken = await _fixture.GetStationTokenAsync(otherGym.StationCode);

            // The employee is checked in at homeGym; the other gym's station must not
            // see that record in its feed.
            var homeToken = await _fixture.GetStationTokenAsync(homeGym.StationCode);
            var punch = _fixture.StationRequest(HttpMethod.Post, "/api/attendance/events", new
            {
                employeeId = employee.EmployeeNumber,
                type = "IN",
                livenessScore = 0.95,
            }, homeToken);
            Assert.Equal(HttpStatusCode.Created, (await _fixture.Client.SendAsync(punch)).StatusCode);

            var request = _fixture.StationRequest(HttpMethod.Get, "/api/attendance/station-summary", null, otherStationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(0, body.GetProperty("presentCount").GetInt32());
            Assert.Empty(body.GetProperty("records").EnumerateArray());
        }

        [Fact]
        public async Task Summary_GymScopedUserToken_Returns200()
        {
            // Karim's token is scoped to gym 1, so it may read that gym's dashboard.
            var token = await _fixture.LoginAsync(
                "karim@revive.hr",
                ReviveHRSystem.Web.DataSeed.DevelopmentDataSeeder.EmployeePassword);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/attendance/station-summary", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task Summary_ExpiredSession_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<Presistence.Data.ReviveHrDbContext>();
                var session = await db.StationSessions.FirstAsync(s => s.GymId == gym.GymId);
                session.ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
                await db.SaveChangesAsync();
            }

            var request = _fixture.StationRequest(HttpMethod.Get, "/api/attendance/station-summary", null, stationToken);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }
}