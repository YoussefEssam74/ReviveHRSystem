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
    /// GET /api/me - session context: identity, gym options, per-gym role, led team
    /// and effective feature levels (ADR-003 Amendment 1). Feature levels are
    /// resolved for the gym the access token is scoped to.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class MeControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public MeControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private async Task<(HttpStatusCode Status, JsonElement Body)> GetMeAsync(string token)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/me", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return (response.StatusCode, body);
        }

        private static int LevelOf(JsonElement body, string feature) =>
            body.GetProperty("featureLevels").TryGetProperty(feature, out var level)
                ? level.GetInt32()
                : 0;

        [Fact]
        public async Task GetMe_WithoutToken_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/me");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetMe_BranchManagerAtActiveGym_ReportsRoleAndManagementLevels()
        {
            // Omar is Branch Manager at gym1 and Team Leader at gym2; login selects a gym.
            var token = await LoginOmarAtGym1Async();

            var (status, body) = await GetMeAsync(token);

            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Equal("omar@revive.hr", body.GetProperty("email").GetString());
            Assert.Equal("Employee", body.GetProperty("userType").GetString());
            Assert.Equal("Branch Manager", body.GetProperty("roleInActiveGym").GetString());
            Assert.Equal(2, body.GetProperty("gyms").GetArrayLength());

            var gym1Name = await Gym1NameAsync();
            Assert.Equal(gym1Name, body.GetProperty("activeGym").GetProperty("gymName").GetString());

            // Branch Manager bundle: management features at Edit, evaluations View, rest None.
            Assert.Equal(2, LevelOf(body, "employees"));
            Assert.Equal(2, LevelOf(body, "attendance"));
            Assert.Equal(2, LevelOf(body, "schedule"));
            Assert.Equal(2, LevelOf(body, "requests"));
            Assert.Equal(2, LevelOf(body, "recruitment"));
            Assert.Equal(2, LevelOf(body, "offboarding"));
            Assert.Equal(1, LevelOf(body, "evaluations"));
            Assert.Equal(0, LevelOf(body, "payroll"));
            Assert.Equal(0, LevelOf(body, "reports"));
        }

        [Fact]
        public async Task GetMe_TeamLeaderAtActiveGym_KeepsFullCapabilityLevels()
        {
            // Same user as the Branch Manager case, active gym switched to gym2 where he is Team Leader.
            var switchRequest = _fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/auth/switch-gym", new { gymId = await Gym2IdAsync() },
                await LoginOmarAtGym1Async());
            var switchResponse = await _fixture.Client.SendAsync(switchRequest);
            switchResponse.EnsureSuccessStatusCode();
            var switchBody = await switchResponse.Content.ReadFromJsonAsync<JsonElement>();
            var switchedToken = switchBody.GetProperty("accessToken").GetString()!;

            var (status, body) = await GetMeAsync(switchedToken);

            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Equal("Team Leader", body.GetProperty("roleInActiveGym").GetString());

            // Full parity with Branch Manager at feature level (ADR-003 Amendment 1):
            // scope is the only difference, and it is resolved from the server side.
            Assert.Equal(2, LevelOf(body, "employees"));
            Assert.Equal(2, LevelOf(body, "attendance"));
            Assert.Equal(2, LevelOf(body, "schedule"));
            Assert.Equal(2, LevelOf(body, "requests"));
            Assert.Equal(1, LevelOf(body, "evaluations"));
            Assert.Equal(0, LevelOf(body, "payroll"));
        }

        [Fact]
        public async Task GetMe_PlainEmployee_HasNoManagementLevels()
        {
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var (status, body) = await GetMeAsync(token);

            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Equal("Employee", body.GetProperty("roleInActiveGym").GetString());
            Assert.Empty(body.GetProperty("featureLevels").EnumerateObject());
        }

        [Fact]
        public async Task GetMe_HRUser_ReportsHRBundle()
        {
            var token = await _fixture.LoginAsync("hr@revive.hr", "Revive!2026");

            var (status, body) = await GetMeAsync(token);

            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Equal("HR", body.GetProperty("roleInActiveGym").GetString());
            Assert.Equal(2, LevelOf(body, "employees"));
            Assert.Equal(2, LevelOf(body, "evaluations"));
            Assert.Equal(1, LevelOf(body, "payroll"));
            Assert.Equal(2, LevelOf(body, "announcements"));
            Assert.Equal(1, LevelOf(body, "audit"));
        }

        [Fact]
        public async Task GetMe_SuperAdmin_HasWildcardAccess()
        {
            // Super Admin holds two gyms, so login issues an unscoped token: the
            // active gym is chosen with the in-session switcher (ADR-002 Amendment 1).
            var adminToken = await _fixture.GetAdminTokenAsync();
            var gymId = await Gym1IdAsync();
            var switchRequest = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/auth/switch-gym", new { gymId }, adminToken);
            var switchResponse = await _fixture.Client.SendAsync(switchRequest);
            switchResponse.EnsureSuccessStatusCode();
            var switchBody = await switchResponse.Content.ReadFromJsonAsync<JsonElement>();
            var token = switchBody.GetProperty("accessToken").GetString()!;

            var (status, body) = await GetMeAsync(token);

            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Equal("Super Admin", body.GetProperty("roleInActiveGym").GetString());
            // The seeded wildcard grant covers payroll - a feature no management bundle grants.
            Assert.Equal(2, LevelOf(body, "payroll"));
            Assert.Equal(2, LevelOf(body, "audit"));
        }

        private async Task<string> LoginOmarAtGym1Async()
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "omar@revive.hr",
                password = "Revive!2026"
            });
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(loginBody.GetProperty("requiresGymSelection").GetBoolean());

            var gymId = await Gym1IdAsync();
            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new
            {
                gymId,
                tempSessionToken = loginBody.GetProperty("tempSessionToken").GetString()
            });
            select.EnsureSuccessStatusCode();
            var selectBody = await select.Content.ReadFromJsonAsync<JsonElement>();
            return selectBody.GetProperty("accessToken").GetString()!;
        }

        private async Task<int> Gym1IdAsync() => await GymIdByNameAsync("Revive Main Gym");
        private async Task<int> Gym2IdAsync() => await GymIdByNameAsync("Revive Second Gym");

        private async Task<string> Gym1NameAsync()
        {
            var gym1Id = await Gym1IdAsync();
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var gym = await db.Gyms.FirstAsync(g => g.Id == gym1Id);
            return gym.Name;
        }

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }
    }
}
