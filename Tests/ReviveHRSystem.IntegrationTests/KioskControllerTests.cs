using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.AttendanceModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Shared.Configuration;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    [Collection(ApiTestFixture.CollectionName)]
    public class KioskControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public KioskControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task StationLogin_ValidCode_ReturnsGymContext_AndSessionToken()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = _fixture.Gym1StationCode });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(body.GetProperty("gymId").GetInt32() > 0);
            Assert.Equal("Revive Main Gym", body.GetProperty("gymName").GetString());
            // A station session token is issued for subsequent attendance requests.
            var token = body.GetProperty("token").GetString();
            Assert.False(string.IsNullOrWhiteSpace(token));
            Assert.Equal(64, token!.Length); // 256-bit token, hex encoded
            Assert.True(body.GetProperty("sessionExpiresAtUtc").GetDateTime() > DateTime.UtcNow);
            // No device artifacts in the contract.
            Assert.False(body.TryGetProperty("deviceToken", out _));
            Assert.False(body.TryGetProperty("deviceId", out _));
        }

        [Fact]
        public async Task StationLogin_StoresOnlyATokenHash_NeverThePlaintextToken()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = _fixture.Gym2StationCode });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var token = body.GetProperty("token").GetString()!;

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var sessions = await db.StationSessions.ToListAsync();

            Assert.NotEmpty(sessions);
            // The plaintext is never recoverable from the database.
            Assert.DoesNotContain(sessions, s => s.TokenHash == token);
            Assert.All(sessions, s => Assert.NotEqual(default, s.ExpiresAtUtc));
        }

        [Fact]
        public async Task StationLogin_WrongCode_Returns401()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = "000000" });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("Invalid or expired station code.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task StationLogin_ExpiredCode_Returns401()
        {
            // A code whose 5-minute lifetime elapsed is rejected exactly like an unknown
            // one — the response must not reveal which of the two happened.
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            await ExpireStationCodeAsync(gym.StationCode);

            var response = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = gym.StationCode });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("Invalid or expired station code.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task StationLogin_ShortCode_Returns400()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = "12345" });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("Validation Error", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task StationLogin_SetsHttpOnlyStationSessionCookie()
        {
            // The browser receives the session credential as an HttpOnly cookie so the
            // SPA never touches the token; the body token remains for non-browser clients.
            var response = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = _fixture.Gym1StationCode });

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(response.Headers.TryGetValues("Set-Cookie", out var setCookies), "Login must set the station session cookie.");
            var setCookie = string.Join(";", setCookies!);
            Assert.Contains(StationSessionOptions.SessionCookieName + "=", setCookie, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("samesite=lax", setCookie, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("path=/", setCookie, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task StationSession_RestoredByCookieAlone_ReturnsGymContext()
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = _fixture.Gym1StationCode });
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            var cookieValue = ReadStationSessionCookie(login);

            // Cookie only, no header: exactly what a rebooted kiosk browser sends on load.
            var request = new HttpRequestMessage(HttpMethod.Get, "/api/kiosk/session");
            request.Headers.TryAddWithoutValidation("Cookie", $"{StationSessionOptions.SessionCookieName}={cookieValue}");
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(loginBody.GetProperty("gymId").GetInt32(), body.GetProperty("gymId").GetInt32());
            Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("gymName").GetString()));
            Assert.True(body.GetProperty("sessionExpiresAtUtc").GetDateTime() > DateTime.UtcNow);
        }

        [Fact]
        public async Task StationSession_WithoutCookieOrHeader_Returns401()
        {
            // Indistinguishable from "no enrolled session" to the client.
            var response = await _fixture.Client.GetAsync("/api/kiosk/session");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task StationLogout_RevokesSession_AndClearsCookie()
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = _fixture.Gym1StationCode });
            var cookieValue = ReadStationSessionCookie(login);

            var logoutRequest = new HttpRequestMessage(HttpMethod.Post, "/api/kiosk/logout");
            logoutRequest.Headers.TryAddWithoutValidation("Cookie", $"{StationSessionOptions.SessionCookieName}={cookieValue}");
            var logout = await _fixture.Client.SendAsync(logoutRequest);

            Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
            // The browser is told to drop the cookie: expired Set-Cookie on the same path.
            Assert.True(logout.Headers.TryGetValues("Set-Cookie", out var clearedCookies), "Logout must clear the station session cookie.");
            var cleared = string.Join(";", clearedCookies!);
            Assert.Contains(StationSessionOptions.SessionCookieName + "=", cleared, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("expires=", cleared, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("path=/", cleared, StringComparison.OrdinalIgnoreCase);

            // The revoked session no longer restores even if the old cookie is replayed.
            var restoreRequest = new HttpRequestMessage(HttpMethod.Get, "/api/kiosk/session");
            restoreRequest.Headers.TryAddWithoutValidation("Cookie", $"{StationSessionOptions.SessionCookieName}={cookieValue}");
            var restore = await _fixture.Client.SendAsync(restoreRequest);
            Assert.Equal(HttpStatusCode.Unauthorized, restore.StatusCode);
        }

        private static string ReadStationSessionCookie(HttpResponseMessage response)
        {
            Assert.True(response.Headers.TryGetValues("Set-Cookie", out var setCookies), "Login must set the station session cookie.");

            string? cookie = null;
            foreach (var value in setCookies!)
            {
                if (value.StartsWith(StationSessionOptions.SessionCookieName + "=", StringComparison.OrdinalIgnoreCase))
                {
                    cookie = value;
                    break;
                }
            }

            Assert.NotNull(cookie);
            return cookie!.Split(';', 2)[0].Split('=', 2)[1];
        }

        private async Task ExpireStationCodeAsync(string code)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var stationCode = await db.StationCodes.FirstOrDefaultAsync(sc => sc.Code == code);
            Assert.NotNull(stationCode);
            stationCode!.ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }
    }
}
