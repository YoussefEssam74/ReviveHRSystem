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

        [Fact]
        public async Task Logout_ValidToken_Returns204_AndWritesAuditEntry()
        {
            var token = await _fixture.GetAdminTokenAsync();

            int userId;
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                userId = (await db.Users.FirstAsync(u => u.Email == "admin@revive.hr")).Id;
            }

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/auth/logout", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

            using var verify = _fixture.Services.CreateScope();
            var db2 = verify.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            Assert.True(await db2.AuditLogs.AnyAsync(a =>
                a.UserId == userId && a.Action == "Logout" && a.EntityType == "User"));
        }

        [Fact]
        public async Task Logout_WithoutToken_Returns401()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/auth/logout", new { });
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        #region Current User (GET /api/auth/me)

        [Fact]
        public async Task Me_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/auth/me");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Me_Admin_ReturnsTopManagementProfile()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/auth/me", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("admin@revive.hr", body.GetProperty("email").GetString());
            Assert.Equal("TopManagement", body.GetProperty("role").GetString());
            // Admin has no employee profile — the name falls back to the user name.
            Assert.Equal("admin", body.GetProperty("fullName").GetString());
            Assert.Equal("A", body.GetProperty("initials").GetString());
            // Admin tokens carry no gym claim, so no gym is pre-selected.
            Assert.Equal(JsonValueKind.Null, body.GetProperty("selectedGym").ValueKind);
            // Access to both seeded gyms.
            Assert.True(body.GetProperty("gyms").GetArrayLength() >= 2);
            Assert.True(body.TryGetProperty("permissions", out _));
        }

        [Fact]
        public async Task Me_Employee_ReturnsProfileWithSelectedGym()
        {
            var (status, loginBody) = await LoginAsync(new { email = "karim@revive.hr", password = "Revive!2026" });
            Assert.Equal(HttpStatusCode.OK, status);
            var token = loginBody.GetProperty("accessToken").GetString()!;

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var gym1Id = (await db.Gyms.FirstAsync(g => g.Name == "Revive Main Gym")).Id;

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/auth/me", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("Karim Hassan", body.GetProperty("fullName").GetString());
            Assert.Equal("Karim", body.GetProperty("firstName").GetString());
            Assert.Equal("Hassan", body.GetProperty("lastName").GetString());
            Assert.Equal("KH", body.GetProperty("initials").GetString());
            Assert.Equal("karim@revive.hr", body.GetProperty("email").GetString());
            Assert.Equal("Fitness Trainer", body.GetProperty("position").GetString());
            Assert.Equal("FullTime", body.GetProperty("employmentType").GetString());
            Assert.Equal("Active", body.GetProperty("status").GetString());
            Assert.Equal("Employee", body.GetProperty("role").GetString());
            // Single-gym tokens carry the gym claim — /me echoes it as the selected gym.
            Assert.Equal(gym1Id, body.GetProperty("selectedGym").GetInt32());
            Assert.Equal(1, body.GetProperty("gyms").GetArrayLength());
            Assert.NotEqual(JsonValueKind.Null, body.GetProperty("hireDate").ValueKind);
        }

        [Fact]
        public async Task Me_GymSelectionFlow_ReflectsChosenGym()
        {
            // Omar has two gyms: pick gym 2 at login, then /me must echo that choice.
            var (status, loginBody) = await LoginAsync(new { email = "omar@revive.hr", password = "Revive!2026" });
            Assert.Equal(HttpStatusCode.OK, status);
            var tempToken = loginBody.GetProperty("tempSessionToken").GetString()!;

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var gym2Id = (await db.Gyms.FirstAsync(g => g.Name == "Revive Second Gym")).Id;

            var selectResponse = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new
            {
                gymId = gym2Id,
                tempSessionToken = tempToken
            });
            var selectBody = await selectResponse.Content.ReadFromJsonAsync<JsonElement>();
            var token = selectBody.GetProperty("accessToken").GetString()!;

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/auth/me", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(gym2Id, body.GetProperty("selectedGym").GetInt32());
            // Both assigned gyms are listed regardless of the token's scope.
            Assert.Equal(2, body.GetProperty("gyms").GetArrayLength());
            Assert.Equal("Omar Youssef", body.GetProperty("fullName").GetString());
        }

        #endregion
    }
}
