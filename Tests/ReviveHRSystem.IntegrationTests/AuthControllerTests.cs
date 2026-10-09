using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ServiceAbstraction.Services;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    [Collection(ApiTestFixture.CollectionName)]
    public class AuthControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public AuthControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private async Task<(HttpStatusCode Status, JsonElement Body)> LoginAsync(object credentials)
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/auth/login", credentials);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return (response.StatusCode, body);
        }

        [Fact]
        public async Task Login_ValidAdmin_ReturnsTokenWithUser()
        {
            var (status, body) = await LoginAsync(new
            {
                email = "admin@revive.hr",
                password = "Revive!2026"
            });

            Assert.Equal(HttpStatusCode.OK, status);
            Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("accessToken").GetString()));
            Assert.True(body.GetProperty("expiresInSeconds").GetInt32() > 0);

            var user = body.GetProperty("user");
            Assert.Equal("admin@revive.hr", user.GetProperty("email").GetString());
            Assert.Equal("TopManagement", user.GetProperty("userType").GetString());
            Assert.True(user.GetProperty("gymAccess").GetArrayLength() >= 1);
            Assert.False(user.TryGetProperty("passwordHash", out _));
        }

        [Fact]
        public async Task Login_WrongPassword_Returns401_InvalidCredentials()
        {
            var (status, body) = await LoginAsync(new
            {
                email = "admin@revive.hr",
                password = "not-the-password"
            });

            Assert.Equal(HttpStatusCode.Unauthorized, status);
            Assert.Equal("Invalid email or password.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Login_UnknownEmail_Returns401_SameMessageAsWrongPassword()
        {
            var wrongPassword = await LoginAsync(new { email = "admin@revive.hr", password = "nope" });
            var unknownEmail = await LoginAsync(new { email = "nobody@test.local", password = "nope" });

            Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.Status);
            Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.Status);
            // No user enumeration: identical message for both failure modes.
            Assert.Equal(
                wrongPassword.Body.GetProperty("errorMessage").GetString(),
                unknownEmail.Body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Login_MissingEmail_Returns400_ValidationFailed()
        {
            var (status, body) = await LoginAsync(new { password = "Revive!2026" });

            Assert.Equal(HttpStatusCode.BadRequest, status);
            Assert.Equal("Validation Error", body.GetProperty("errorMessage").GetString());
            Assert.True(body.GetProperty("validationErrors").GetArrayLength() > 0);
        }

        [Fact]
        public async Task Login_EmployeeWithSingleGym_ReturnsGymScopedSession()
        {
            var (status, body) = await LoginAsync(new
            {
                email = "karim@revive.hr",
                password = "Revive!2026"
            });

            Assert.Equal(HttpStatusCode.OK, status);
            Assert.False(body.GetProperty("requiresGymSelection").GetBoolean());

            var user = body.GetProperty("user");
            Assert.Equal("Employee", user.GetProperty("userType").GetString());
            Assert.Equal(1, user.GetProperty("gymAccess").GetArrayLength());
            Assert.True(user.GetProperty("gymId").GetInt32() > 0);
            Assert.False(string.IsNullOrWhiteSpace(user.GetProperty("gymName").GetString()));
        }

        [Fact]
        public async Task SelectGym_InvalidTempToken_Returns401()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new
            {
                gymId = 1,
                tempSessionToken = "not-a-real-token"
            });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("Your session has expired. Please sign in again.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task SelectGym_ValidTokenWithoutGymAccess_Returns401()
        {
            using var scope = _fixture.Services.CreateScope();

            // Mint a legitimate temp session token for karim via the real token service.
            var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var karimUserId = (await db.Users.FirstAsync(u => u.Email == "karim@revive.hr")).Id;
            var tempToken = tokenService.CreateGymSelectionToken(karimUserId);

            // Karim has access only to gym 1 — selecting gym 2 must be denied.
            var response = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new
            {
                gymId = 2,
                tempSessionToken = tempToken
            });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("You do not have access to the selected gym.", body.GetProperty("errorMessage").GetString());
        }
    }
}
