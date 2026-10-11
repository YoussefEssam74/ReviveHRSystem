using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ReviveHRSystem.IntegrationTests.Fixtures;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// POST /api/auth/switch-gym - in-session gym switching (ADR-002 Amendment 1).
    /// Multi-gym employees switch without re-authenticating; the new token is scoped to
    /// the chosen gym and the response refreshes the per-gym feature levels.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class SwitchGymTests
    {
        private readonly ApiTestFixture _fixture;

        public SwitchGymTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task SwitchGym_MultiGymEmployee_ReturnsTokenScopedToNewGym()
        {
            var token = await LoginSelectingGymAsync("omar@revive.hr", await GymIdByNameAsync("Revive Main Gym"));

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/auth/switch-gym", new { gymId = await GymIdByNameAsync("Revive Second Gym") }, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("accessToken").GetString()));
            Assert.True(body.GetProperty("expiresInSeconds").GetInt32() > 0);
            Assert.Equal("Revive Second Gym", body.GetProperty("me").GetProperty("activeGym").GetProperty("gymName").GetString());
            Assert.Equal("Team Leader", body.GetProperty("me").GetProperty("roleInActiveGym").GetString());

            // The new token must authenticate and report the new gym as active.
            var meRequest = _fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/me", null, body.GetProperty("accessToken").GetString()!);
            var meResponse = await _fixture.Client.SendAsync(meRequest);
            meResponse.EnsureSuccessStatusCode();
            var meBody = await meResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Revive Second Gym", meBody.GetProperty("activeGym").GetProperty("gymName").GetString());
        }

        [Fact]
        public async Task SwitchGym_SingleGymEmployeeWithoutAccess_Returns401()
        {
            // Karim only has gym1 access.
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/auth/switch-gym", new { gymId = await GymIdByNameAsync("Revive Second Gym") }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task SwitchGym_UnknownGym_Returns401()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/auth/switch-gym", new { gymId = 999999 }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task SwitchGym_WithoutToken_Returns401()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/auth/switch-gym", new { gymId = 1 });
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        private async Task<string> LoginSelectingGymAsync(string email, int gymId)
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new { email, password = "Revive!2026" });
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            var token = loginBody.GetProperty("tempSessionToken").GetString()!;

            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new { gymId, tempSessionToken = token });
            select.EnsureSuccessStatusCode();
            var selectBody = await select.Content.ReadFromJsonAsync<JsonElement>();
            return selectBody.GetProperty("accessToken").GetString()!;
        }

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Presistence.Data.ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }
    }
}
