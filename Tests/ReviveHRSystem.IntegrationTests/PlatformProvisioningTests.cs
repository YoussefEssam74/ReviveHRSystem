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
    /// Super Admin provisioning through the console's own endpoints: the create-gym
    /// flow no longer asks for an account code (the API derives a unique one), and the
    /// HR-manager wizard hands the operator the initial password it set.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class PlatformProvisioningTests
    {
        private readonly ApiTestFixture _fixture;

        public PlatformProvisioningTests(ApiTestFixture fixture) => _fixture = fixture;

        private ReviveHrDbContext Db => _fixture.Services.GetRequiredService<ReviveHrDbContext>();

        private Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body, string token)
            => _fixture.Client.SendAsync(_fixture.AuthorizedRequest(method, url, body, token));

        private async Task<JsonElement> CreateCompanyAsync(string token, string name)
        {
            var planId = (await Db.SubscriptionPlans.FirstAsync(plan => !plan.IsArchived)).Id;
            var response = await SendAsync(HttpMethod.Post, "/api/platform/companies", new
            {
                name,
                city = "Cairo",
                primaryBranch = new { name = $"{name} — Maadi" },
                contact = new { name = "Gym Owner", email = $"owner-{Guid.NewGuid():N}@test.local".ToLowerInvariant() },
                subscription = new { planId, startTrial = false },
                assignHrLater = true,
            }, token);

            var payload = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.Created, payload);
            using var document = JsonDocument.Parse(payload);
            return document.RootElement.Clone();
        }

        [Fact]
        public async Task CreateCompany_WithoutCode_GeneratesAUniqueCode()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            // Same name twice: the derived code must stay unique across accounts.
            var name = $"Zeta Coast {Guid.NewGuid():N}"[..22];

            var first = await CreateCompanyAsync(admin, name);
            var second = await CreateCompanyAsync(admin, name);

            var firstCode = first.GetProperty("code").GetString();
            Assert.False(string.IsNullOrWhiteSpace(firstCode));
            Assert.NotEqual(firstCode, second.GetProperty("code").GetString());
        }

        [Fact]
        public async Task CreateHrManager_WithInitialPassword_CanSignIn()
        {
            var admin = await _fixture.GetAdminTokenAsync();
            var email = $"platform-hr-{Guid.NewGuid():N}@test.local".ToLowerInvariant();
            const string password = "Chosen!Pass9";

            var response = await SendAsync(HttpMethod.Post, "/api/platform/users/hr-managers", new
            {
                fullName = "Platform HR",
                email,
                password,
                phone = "+20 100 000 0000",
                dateOfBirth = "1999-01-01",
                gender = "Female",
                nationalId = "29901011234567",
                hireDate = "2026-01-05",
                photoUrl = "data:image/png;base64,iVBORw0KGgo=",
                sendInvite = false,
            }, admin);
            Assert.True(
                response.StatusCode == HttpStatusCode.Created,
                await response.Content.ReadAsStringAsync());

            var created = await response.Content.ReadFromJsonAsync<JsonElement>();
            var detailResponse = await SendAsync(HttpMethod.Get, $"/api/platform/users/{created.GetProperty("id").GetInt32()}", null, admin);
            Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
            var detail = await detailResponse.Content.ReadFromJsonAsync<JsonElement>();

            // The wizard's personal fields are stored, not just echoed back.
            Assert.Equal("+20 100 000 0000", detail.GetProperty("phone").GetString());
            Assert.Equal("Female", detail.GetProperty("gender").GetString());
            Assert.Equal("29901011234567", detail.GetProperty("nationalId").GetString());
            Assert.Equal("1999-01-01", detail.GetProperty("dateOfBirth").GetString()![..10]);
            Assert.Equal("2026-01-05", detail.GetProperty("hireDate").GetString()![..10]);
            Assert.StartsWith("data:image/png", detail.GetProperty("photoUrl").GetString());

            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new { email, password });
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        }
    }
}
