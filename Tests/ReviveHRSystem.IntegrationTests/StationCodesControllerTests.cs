using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    [Collection(ApiTestFixture.CollectionName)]
    public class StationCodesControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public StationCodesControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Get_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/gyms/1/station-codes");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Get_Admin_Returns200_WithActiveCode()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/gyms/{gym.GymId}/station-codes", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(gym.StationCode, body.GetProperty("code").GetString());
            Assert.Equal(gym.GymId, body.GetProperty("gymId").GetInt32());
        }

        [Fact]
        public async Task Get_EmployeeWithoutGymAccess_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var privateGym = await builder.CreateGymWithStationAsync();

            // Karim's login (employee with access only to gym 1).
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "karim@revive.hr",
                password = "Revive!2026"
            });
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            var karimToken = loginBody.GetProperty("accessToken").GetString()!;

            // IDOR regression: karim must not read another gym's station code.
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/gyms/{privateGym.GymId}/station-codes", null, karimToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("You do not have access to this gym.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Rotate_InvalidatesOldCode_IssuesNewOne()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/gyms/{gym.GymId}/station-codes", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var newCode = body.GetProperty("code").GetString();
            Assert.NotNull(newCode);
            Assert.NotEqual(gym.StationCode, newCode);

            // Old code stops working immediately…
            var oldCodeLogin = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = gym.StationCode });
            Assert.Equal(HttpStatusCode.Unauthorized, oldCodeLogin.StatusCode);

            // …and the new code works.
            var newCodeLogin = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = newCode });
            Assert.Equal(HttpStatusCode.OK, newCodeLogin.StatusCode);
        }
    }
}
