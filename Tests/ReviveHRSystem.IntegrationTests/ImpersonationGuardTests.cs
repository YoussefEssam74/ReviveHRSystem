using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ReviveHRSystem.IntegrationTests.Fixtures;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Verifies the guard that stops an impersonation token from reaching platform administration.
    ///
    /// This is the console's most important security control. A Super Admin entering a workspace
    /// receives a token whose <c>userType</c> is still <c>TopManagement</c> — deliberately, so no
    /// downstream code mistakes them for the role they are acting as. Without the guard that same
    /// token would satisfy every <c>platform.*</c> permission check, and "enter a workspace" would
    /// become a way to launder privilege.
    /// </summary>
    [Trait("Suite", "Impersonation")]
    [Collection(ApiTestFixture.CollectionName)]
    public class ImpersonationGuardTests(ApiTestFixture fixture)
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        [Fact]
        public async Task ActAsToken_CannotReachPlatformAdministration()
        {
            var (started, startBody) = await StartSessionAsync();

            Assert.Equal(HttpStatusCode.Created, started.StatusCode);

            var actToken = startBody!.Value.GetProperty("accessToken").GetString();
            Assert.False(string.IsNullOrWhiteSpace(actToken));

            // Every platform surface must refuse the workspace token, even though its userType is
            // TopManagement and the caller really is a Super Admin.
            string[] guardedEndpoints =
            [
                "/api/platform/dashboard",
                "/api/platform/companies",
                "/api/platform/users",
                "/api/platform/plans",
                "/api/platform/invoices",
                "/api/platform/revenue/summary",
                "/api/platform/audit",
                "/api/platform/settings",
                "/api/platform/feature-flags",
            ];

            foreach (var endpoint in guardedEndpoints)
            {
                var response = await fixture.Client.SendAsync(
                    fixture.AuthorizedRequest(HttpMethod.Get, endpoint, null, actToken!));

                Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            }
        }

        [Fact]
        public async Task ActAsToken_CanStillAskAboutItsOwnSessionAndCloseIt()
        {
            var (started, startBody) = await StartSessionAsync();
            Assert.Equal(HttpStatusCode.Created, started.StatusCode);

            var actToken = startBody!.Value.GetProperty("accessToken").GetString()!;
            var sessionId = startBody.Value.GetProperty("sessionId").GetInt32();

            // The two exemptions: the banner has to be able to ask whether it is still open, and
            // the session has to be able to close itself.
            var current = await fixture.Client.SendAsync(
                fixture.AuthorizedRequest(HttpMethod.Get, "/api/platform/impersonation/current", null, actToken));

            Assert.Equal(HttpStatusCode.OK, current.StatusCode);
            var currentBody = await current.Content.ReadFromJsonAsync<JsonElement>(Json);
            Assert.True(currentBody.GetProperty("active").GetBoolean());
            Assert.Equal(sessionId, currentBody.GetProperty("sessionId").GetInt32());

            var end = await fixture.Client.SendAsync(
                fixture.AuthorizedRequest(
                    HttpMethod.Post, "/api/platform/impersonation/end", new { sessionId }, actToken));

            Assert.Equal(HttpStatusCode.OK, end.StatusCode);
        }

        [Fact]
        public async Task EndingASession_ReportsItInactiveAndRefusesASecondEnd()
        {
            var (started, startBody) = await StartSessionAsync();
            Assert.Equal(HttpStatusCode.Created, started.StatusCode);

            var actToken = startBody!.Value.GetProperty("accessToken").GetString()!;
            var sessionId = startBody.Value.GetProperty("sessionId").GetInt32();

            var end = await fixture.Client.SendAsync(
                fixture.AuthorizedRequest(
                    HttpMethod.Post, "/api/platform/impersonation/end", new { sessionId }, actToken));
            Assert.Equal(HttpStatusCode.OK, end.StatusCode);

            // The token is still cryptographically valid, but it no longer represents a usable
            // workspace — which is exactly what tells the SPA to drop the banner.
            var current = await fixture.Client.SendAsync(
                fixture.AuthorizedRequest(HttpMethod.Get, "/api/platform/impersonation/current", null, actToken));
            Assert.Equal(HttpStatusCode.OK, current.StatusCode);
            var body = await current.Content.ReadFromJsonAsync<JsonElement>(Json);
            Assert.False(body.GetProperty("active").GetBoolean());

            var secondEnd = await fixture.Client.SendAsync(
                fixture.AuthorizedRequest(
                    HttpMethod.Post, "/api/platform/impersonation/end", new { sessionId }, actToken));
            Assert.Equal(HttpStatusCode.BadRequest, secondEnd.StatusCode);
        }

        [Fact]
        public async Task Impersonation_RequiresAReason()
        {
            var adminToken = await fixture.GetAdminTokenAsync();
            var companyId = await FirstCompanyIdAsync(adminToken);

            var response = await fixture.Client.SendAsync(
                fixture.AuthorizedRequest(
                    HttpMethod.Post,
                    "/api/platform/impersonation/start",
                    new { companyId, reason = "no" },
                    adminToken));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        /// <summary>Opens a real session as the seeded Super Admin, for the guard assertions.</summary>
        private async Task<(HttpResponseMessage Response, JsonElement? Body)> StartSessionAsync()
        {
            var adminToken = await fixture.GetAdminTokenAsync();
            var companyId = await FirstCompanyIdAsync(adminToken);

            var response = await fixture.Client.SendAsync(
                fixture.AuthorizedRequest(
                    HttpMethod.Post,
                    "/api/platform/impersonation/start",
                    new { companyId, reason = "Integration test: verify the act-as guard." },
                    adminToken));

            if (response.StatusCode != HttpStatusCode.Created)
            {
                return (response, null);
            }

            var body = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
            return (response, body);
        }

        /// <summary>The first company the seeded Super Admin can see — the workspace target.</summary>
        private async Task<int> FirstCompanyIdAsync(string adminToken)
        {
            var response = await fixture.Client.SendAsync(
                fixture.AuthorizedRequest(HttpMethod.Get, "/api/platform/companies", null, adminToken));

            response.EnsureSuccessStatusCode();

            var body = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
            var items = body.GetProperty("items");

            Assert.True(items.GetArrayLength() > 0, "The fixture seeded no companies to enter.");

            return items[0].GetProperty("id").GetInt32();
        }
    }
}
