using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Shared.Configuration;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Security surface of the station-session credential model: enrollment codes are
    /// short-lived, sessions are opaque + DB-backed, and every attendance request's gym
    /// comes from the validated session rather than from the request body.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class StationSessionControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public StationSessionControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        private async Task<(TestGym Gym, TestEmployee Employee, string StationToken)> NewStationWithEmployeeAsync()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);
            return (gym, employee, stationToken);
        }

        private static object EventPayload(string employeeNumber, string type = "IN") =>
            new { employeeId = employeeNumber, type, livenessScore = 0.95 };

        private async Task<HttpResponseMessage> PostEventAsync(string employeeNumber, string stationToken)
        {
            var request = _fixture.StationRequest(
                HttpMethod.Post, "/api/attendance/events", EventPayload(employeeNumber), stationToken);
            return await _fixture.Client.SendAsync(request);
        }

        [Fact]
        public async Task Session_ExpiresPerConfiguredLifetime()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = _fixture.Gym1StationCode });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var expiresAtUtc = body.GetProperty("sessionExpiresAtUtc").GetDateTime();

            // Configured StationSession:LifetimeHours (720h = 30 days; a 1-minute tolerance for clock drift).
            var lifetimeHours = _fixture.Services.GetRequiredService<IOptions<StationSessionOptions>>().Value.LifetimeHours;
            Assert.InRange(expiresAtUtc, DateTime.UtcNow.AddHours(lifetimeHours).AddMinutes(-1), DateTime.UtcNow.AddHours(lifetimeHours).AddMinutes(1));
        }

        [Fact]
        public async Task Session_EachLoginIssuesItsOwnWorkingToken()
        {
            var (_, employee, firstToken) = await NewStationWithEmployeeAsync();

            var second = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = _fixture.Gym2StationCode });
            var secondBody = await second.Content.ReadFromJsonAsync<JsonElement>();
            var secondToken = secondBody.GetProperty("token").GetString()!;

            Assert.NotEqual(firstToken, secondToken);

            var firstResult = await PostEventAsync(employee.EmployeeNumber, firstToken);
            Assert.Equal(HttpStatusCode.Created, firstResult.StatusCode);
        }

        [Fact]
        public async Task Session_ExpiredSession_IsRejected_OnAttendance()
        {
            var (gym, employee, stationToken) = await NewStationWithEmployeeAsync();

            // Simulate the session's lifetime elapsing.
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var session = await db.StationSessions.FirstAsync(s => s.GymId == gym.GymId);
                session.ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
                await db.SaveChangesAsync();
            }

            var response = await PostEventAsync(employee.EmployeeNumber, stationToken);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Session_RevokedSession_IsRejected_OnAttendance()
        {
            var (_, employee, stationToken) = await NewStationWithEmployeeAsync();
            await SetSessionRevokedAsync(stationToken);

            var response = await PostEventAsync(employee.EmployeeNumber, stationToken);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Session_Rotation_Keeps_Enrolled_Stations_Working()
        {
            // Rotating the code stops NEW enrollments but never disconnects kiosks that
            // are already on the floor.
            var (gym, employee, stationToken) = await NewStationWithEmployeeAsync();
            var adminToken = await _fixture.GetAdminTokenAsync();

            var rotate = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/gyms/{gym.GymId}/station-codes", null, adminToken);
            var rotateResponse = await _fixture.Client.SendAsync(rotate);
            Assert.Equal(HttpStatusCode.OK, rotateResponse.StatusCode);

            // The old code can no longer enroll…
            var oldLogin = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = gym.StationCode });
            Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);

            // …but the already-enrolled station keeps recording.
            var eventResponse = await PostEventAsync(employee.EmployeeNumber, stationToken);
            Assert.Equal(HttpStatusCode.Created, eventResponse.StatusCode);

            // And a fresh code re-enrolls a station normally.
            var rotateBody = await rotateResponse.Content.ReadFromJsonAsync<JsonElement>();
            var newCode = rotateBody.GetProperty("code").GetString()!;
            Assert.NotEqual(gym.StationCode, newCode);

            var newLogin = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = newCode });
            var newLoginBody = await newLogin.Content.ReadFromJsonAsync<JsonElement>();
            var newToken = newLoginBody.GetProperty("token").GetString()!;
            var newEmployee = await new TestDataBuilder(_fixture.Services)
                .CreateEmployeeAsync(gym, shiftAtGym: gym);
            var newEvent = await PostEventAsync(newEmployee.EmployeeNumber, newToken);
            Assert.Equal(HttpStatusCode.Created, newEvent.StatusCode);
        }

        [Fact]
        public async Task Session_RevokeEndpoint_Disconnects_Enrolled_Stations()
        {
            var (gym, employee, stationToken) = await NewStationWithEmployeeAsync();
            var adminToken = await _fixture.GetAdminTokenAsync();

            var revoke = _fixture.AuthorizedRequest(
                HttpMethod.Delete, $"/api/gyms/{gym.GymId}/station-sessions", null, adminToken);
            var revokeResponse = await _fixture.Client.SendAsync(revoke);

            Assert.Equal(HttpStatusCode.OK, revokeResponse.StatusCode);
            var revokeBody = await revokeResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(revokeBody.GetProperty("revokedCount").GetInt32() >= 1);

            var eventResponse = await PostEventAsync(employee.EmployeeNumber, stationToken);
            Assert.Equal(HttpStatusCode.Unauthorized, eventResponse.StatusCode);
        }

        [Fact]
        public async Task Session_RevokeEndpoint_HrWithoutGymAccess_Returns401()
        {
            var (gym, _, _) = await NewStationWithEmployeeAsync();
            var hrGym = await NewBuilder().CreateGymWithStationAsync();
            var hr = await NewBuilder().CreateUserAsync(UserType.HR, new[] { hrGym });
            var hrToken = await _fixture.LoginAsync(hr.Email, hr.Password);

            var revoke = _fixture.AuthorizedRequest(
                HttpMethod.Delete, $"/api/gyms/{gym.GymId}/station-sessions", null, hrToken);
            var response = await _fixture.Client.SendAsync(revoke);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Session_RevokeEndpoint_EmployeeSession_Returns401()
        {
            var (gym, _, _) = await NewStationWithEmployeeAsync();
            var employee = await NewBuilder().CreateEmployeeAsync(gym);
            var employeeToken = await _fixture.LoginAsync(employee.Email, employee.Password);

            var revoke = _fixture.AuthorizedRequest(
                HttpMethod.Delete, $"/api/gyms/{gym.GymId}/station-sessions", null, employeeToken);
            var response = await _fixture.Client.SendAsync(revoke);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Session_RevokeEndpoint_StationSession_Returns401()
        {
            // A kiosk must not be able to revoke itself or its peers.
            var (gym, _, stationToken) = await NewStationWithEmployeeAsync();

            var revoke = _fixture.StationRequest(
                HttpMethod.Delete, $"/api/gyms/{gym.GymId}/station-sessions", null, stationToken);
            var response = await _fixture.Client.SendAsync(revoke);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Session_HrWithGymAccess_CanRevoke()
        {
            var (gym, _, _) = await NewStationWithEmployeeAsync();
            var hr = await NewBuilder().CreateUserAsync(UserType.HR, new[] { gym });
            var hrToken = await _fixture.LoginAsync(hr.Email, hr.Password);

            var revoke = _fixture.AuthorizedRequest(
                HttpMethod.Delete, $"/api/gyms/{gym.GymId}/station-sessions", null, hrToken);
            var response = await _fixture.Client.SendAsync(revoke);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        // --- helpers ---

        /// <summary>Marks the session behind a plaintext token as revoked in the database.</summary>
        private async Task SetSessionRevokedAsync(string stationToken)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var sessions = await db.StationSessions.ToListAsync();
            var session = sessions.Last(); // the newest session belongs to the caller
            session.RevokedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }
}
