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
        public async Task SwitchGym_PermissionKeysFollowTheActiveGym()
        {
            // Omar is Branch Manager in gym1 and Team Leader in gym2. His keys must
            // follow the ACTIVE gym's role — not the union of his global roles — so
            // the TL gym never reports the BM-only keys (e.g. recruitment).
            var token1 = await LoginSelectingGymAsync("omar@revive.hr", await GymIdByNameAsync("Revive Main Gym"));

            var me1 = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, "/api/auth/me", null, token1));
            me1.EnsureSuccessStatusCode();
            var keys1 = (await me1.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("permissions").EnumerateArray().Select(p => p.GetString()!).ToHashSet();

            Assert.Contains("recruitment.view", keys1);          // BM-only key, present in the BM gym
            Assert.Contains("employees.view", keys1);

            var switchRequest = _fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/auth/switch-gym", new { gymId = await GymIdByNameAsync("Revive Second Gym") }, token1);
            var switchResponse = await _fixture.Client.SendAsync(switchRequest);
            switchResponse.EnsureSuccessStatusCode();
            var token2 = (await switchResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()!;

            var me2 = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, "/api/auth/me", null, token2));
            me2.EnsureSuccessStatusCode();
            var keys2 = (await me2.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("permissions").EnumerateArray().Select(p => p.GetString()!).ToHashSet();

            Assert.DoesNotContain("recruitment.view", keys2);    // BM-only key must vanish in the TL gym
            Assert.DoesNotContain("recruitment.vacancy_request.create", keys2);
            Assert.Contains("schedule.view", keys2);             // TL bundle keys still present
            Assert.Contains("schedule.manage", keys2);
            Assert.Contains("employees.view", keys2);            // TL shares the BM branch pages…
            Assert.Contains("attendance.view", keys2);           // …except Recruitment
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

        [Fact]
        public async Task SwitchGym_SeparatesEmployeeDirectory_AndAppliesAccessLevel()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var gym2Id = await GymIdByNameAsync("Revive Second Gym");

            // 1. Omar in Main Gym (Branch Manager)
            var token1 = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);

            var req1 = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees?pageSize=100", null, token1);
            var res1 = await _fixture.Client.SendAsync(req1);
            res1.EnsureSuccessStatusCode();
            var body1 = await res1.Content.ReadFromJsonAsync<JsonElement>();
            var names1 = body1.GetProperty("items").EnumerateArray()
                .Select(e => e.GetProperty("name").GetString()!)
                .ToList();

            // BM in Gym 1 sees Gym 1 employees, but NOT Gym 2 employees
            Assert.Contains("Karim Hassan", names1);
            Assert.Contains("Omar Youssef", names1);
            Assert.DoesNotContain("Sara Ali", names1);

            // 2. Omar switches to Second Gym (Team Leader of Alexandria Floor Team)
            var switchReq = _fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/auth/switch-gym", new { gymId = gym2Id }, token1);
            var switchRes = await _fixture.Client.SendAsync(switchReq);
            switchRes.EnsureSuccessStatusCode();
            var token2 = (await switchRes.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("accessToken").GetString()!;

            var req2 = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees?pageSize=100", null, token2);
            var res2 = await _fixture.Client.SendAsync(req2);
            res2.EnsureSuccessStatusCode();
            var body2 = await res2.Content.ReadFromJsonAsync<JsonElement>();
            var names2 = body2.GetProperty("items").EnumerateArray()
                .Select(e => e.GetProperty("name").GetString()!)
                .ToList();

            // TL in Gym 2 sees only his team in Gym 2 (Sara Ali), NOT Gym 1 employees
            Assert.Contains("Sara Ali", names2);
            Assert.DoesNotContain("Karim Hassan", names2);
            Assert.DoesNotContain("Omar Youssef", names2);

            // 3. Drill-in profile IDOR protection: cannot read Gym 1 employee using Gym 2 token
            var karimId = body1.GetProperty("items").EnumerateArray()
                .First(e => e.GetProperty("name").GetString() == "Karim Hassan")
                .GetProperty("id").GetInt32();
            var saraId = body2.GetProperty("items").EnumerateArray()
                .First(e => e.GetProperty("name").GetString() == "Sara Ali")
                .GetProperty("id").GetInt32();

            var crossGymReq = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{karimId}", null, token2);
            var crossGymRes = await _fixture.Client.SendAsync(crossGymReq);
            Assert.Equal(HttpStatusCode.NotFound, crossGymRes.StatusCode);

            var validTeamReq = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{saraId}", null, token2);
            var validTeamRes = await _fixture.Client.SendAsync(validTeamReq);
            Assert.Equal(HttpStatusCode.OK, validTeamRes.StatusCode);
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
