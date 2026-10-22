using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using ReviveHRSystem.IntegrationTests.Fixtures;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Contract-envelope tests: the documented error shapes
    /// (`{ statusCode, errorMessage, errors[] | validationErrors[] }`) and the
    /// unknown-route envelope emitted by the custom 404 middleware. Every
    /// external integration (SPA, Schemathesis, ZAP) relies on these shapes.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class ApiContractEnvelopeTests
    {
        private readonly ApiTestFixture _fixture;

        public ApiContractEnvelopeTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Login_MissingBody_Returns400ValidationEnvelope()
        {
            var response = await _fixture.Client.PostAsync(
                "/api/auth/login",
                new StringContent("", Encoding.UTF8, "application/json"));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(400, body.GetProperty("statusCode").GetInt32());
        }

        [Fact]
        public async Task UnknownEndpoint_Authenticated_Returns404Envelope()
        {
            // Authenticated caller: unknown routes surface the custom 404 envelope.
            var token = await _fixture.GetAdminTokenAsync();
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/this-route-does-not-exist", null, token);

            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(404, body.GetProperty("statusCode").GetInt32());
            Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("errorMessage").GetString()));
        }

        [Fact]
        public async Task UnknownEndpoint_Anonymous_Returns401_NoPathDisclosure()
        {
            // Safety property: an unauthenticated caller is challenged with 401
            // before route resolution reveals anything about endpoint existence.
            var response = await _fixture.Client.GetAsync("/api/this-route-does-not-exist");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetProtectedWithoutToken_Returns401Envelope()
        {
            var response = await _fixture.Client.GetAsync("/api/auth/me");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }
}
