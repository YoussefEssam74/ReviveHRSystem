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
    /// GET /api/gyms: Top Management sees every active gym, employees see only their
    /// assigned gyms, and anonymous callers are rejected.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class GymsControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public GymsControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Get_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/gyms");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Get_Admin_ReturnsAllActiveGyms_WithBranchAndStaffCount()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/gyms", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(body.GetArrayLength() >= 2);

            var gyms = body.EnumerateArray().ToList();
            var mainGym = gyms.First(g => g.GetProperty("name").GetString() == "Revive Main Gym");
            Assert.Equal("Cairo", mainGym.GetProperty("branch").GetString());
            // Karim and Omar are seeded Active employees with home gym 1.
            Assert.True(mainGym.GetProperty("employees").GetInt32() >= 2);

            var secondGym = gyms.First(g => g.GetProperty("name").GetString() == "Revive Second Gym");
            Assert.Equal("Alexandria", secondGym.GetProperty("branch").GetString());
        }

        [Fact]
        public async Task Get_Employee_ReturnsOnlyAssignedGyms()
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "karim@revive.hr",
                password = "Revive!2026"
            });
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            var token = loginBody.GetProperty("accessToken").GetString()!;

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var gym1Id = (await db.Gyms.FirstAsync(g => g.Name == "Revive Main Gym")).Id;

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/gyms", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // Karim has access to gym 1 only — nothing else may leak into his list.
            var items = body.EnumerateArray().ToList();
            Assert.Single(items);
            Assert.Equal(gym1Id, items[0].GetProperty("id").GetInt32());
            Assert.Equal("Revive Main Gym", items[0].GetProperty("name").GetString());
        }

        [Fact]
        public async Task Get_EmployeeWithTwoGyms_ReturnsBothAssignedGyms()
        {
            // Omar's login requires gym selection; pick gym 2 to mint a scoped token.
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "omar@revive.hr",
                password = "Revive!2026"
            });
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(loginBody.GetProperty("requiresGymSelection").GetBoolean());
            var tempToken = loginBody.GetProperty("tempSessionToken").GetString()!;

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var gym1Id = (await db.Gyms.FirstAsync(g => g.Name == "Revive Main Gym")).Id;
            var gym2Id = (await db.Gyms.FirstAsync(g => g.Name == "Revive Second Gym")).Id;

            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new
            {
                gymId = gym2Id,
                tempSessionToken = tempToken
            });
            var selectBody = await select.Content.ReadFromJsonAsync<JsonElement>();
            var token = selectBody.GetProperty("accessToken").GetString()!;

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/gyms", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // Both assigned gyms are listed — the switcher shows every gym Omar may work at,
            // not just the one his current token is scoped to.
            var ids = body.EnumerateArray()
                .Select(g => g.GetProperty("id").GetInt32())
                .ToList();
            Assert.Equal(2, ids.Count);
            Assert.Contains(gym1Id, ids);
            Assert.Contains(gym2Id, ids);
        }
    }
}
