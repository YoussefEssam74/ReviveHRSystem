using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ReviveHRSystem.IntegrationTests.Fixtures;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    [Collection(ApiTestFixture.CollectionName)]
    public class KioskControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public KioskControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task StationLogin_ValidCode_ReturnsGymContext()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = _fixture.Gym1StationCode });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(body.GetProperty("gymId").GetInt32() > 0);
            Assert.Equal("Revive Main Gym", body.GetProperty("gymName").GetString());
            // A gym-bound station token is issued for subsequent attendance requests.
            Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("token").GetString()));
            // No device artifacts in the contract.
            Assert.False(body.TryGetProperty("deviceToken", out _));
            Assert.False(body.TryGetProperty("deviceId", out _));
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
        public async Task StationLogin_ShortCode_Returns400()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/kiosk/login", new { code = "12345" });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("Validation Error", body.GetProperty("errorMessage").GetString());
        }
    }
}
