using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ReviveHRSystem.IntegrationTests.Fixtures;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Account settings (mock §12): preferences round-trip and password change
    /// validation. The notifications inbox itself is covered by
    /// NotificationsControllerTests (HR portal contract).
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class NotificationsAndSettingsTests
    {
        private readonly ApiTestFixture _fixture;

        public NotificationsAndSettingsTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Notifications_WithoutToken_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/notifications");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Preferences_RoundTrip_Persists()
        {
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var update = _fixture.AuthorizedRequest(HttpMethod.Put, "/api/me/settings", new
            {
                requests = false,
                attendance = true,
                recruitment = false,
                management = true,
                announcements = false
            }, token);
            var updateResponse = await _fixture.Client.SendAsync(update);
            updateResponse.EnsureSuccessStatusCode();

            var get = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/me/settings", null, token);
            var getResponse = await _fixture.Client.SendAsync(get);
            getResponse.EnsureSuccessStatusCode();
            var body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.False(body.GetProperty("requests").GetBoolean());
            Assert.True(body.GetProperty("attendance").GetBoolean());
            Assert.False(body.GetProperty("recruitment").GetBoolean());
        }

        [Fact]
        public async Task ChangePassword_WrongCurrentPassword_Returns401()
        {
            var token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/auth/change-password", new
            {
                currentPassword = "not-the-password",
                newPassword = "BrandNewPass1"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task ChangePassword_ShortNewPassword_Returns400()
        {
            var token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/auth/change-password", new
            {
                currentPassword = "Revive!2026",
                newPassword = "short"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task ChangePassword_Valid_Returns204_And_NewPasswordWorks()
        {
            var token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/auth/change-password", new
            {
                currentPassword = "Revive!2026",
                newPassword = "BrandNewPass1"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

            var relogin = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "hr@revive.hr",
                password = "BrandNewPass1"
            });
            relogin.EnsureSuccessStatusCode();
            var body = await relogin.Content.ReadFromJsonAsync<JsonElement>();
            Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("accessToken").GetString()));

            // Restore the shared seed password so later runs stay predictable.
            var restore = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/auth/change-password", new
            {
                currentPassword = "BrandNewPass1",
                newPassword = "Revive!2026"
            }, body.GetProperty("accessToken").GetString());
            var restoreResponse = await _fixture.Client.SendAsync(restore);
            Assert.Equal(HttpStatusCode.NoContent, restoreResponse.StatusCode);
        }
    }
}
