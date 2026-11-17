using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// HR account lifecycle (api-spec-from-ui.md §4.8 H3/H6 + dashboard D12):
    /// the HR-Team wizard's create (identity + gyms + permissions + optional
    /// role applied atomically → 201 { data }), suspend/reactivate with a
    /// required reason (self-suspend refused; suspend blocks login), and the
    /// admin password reset (min 8 chars, never echoes the plaintext back).
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class UserAccountManagementTests
    {
        private readonly ApiTestFixture _fixture;

        public UserAccountManagementTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        private ReviveHrDbContext Db => _fixture.Services.GetRequiredService<ReviveHrDbContext>();

        private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body, string token)
            => await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(method, url, body, token));

        private static async Task<string> AssertErrorAsync(HttpResponseMessage response, HttpStatusCode expected)
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == expected,
                $"Expected {(int)expected} but got {(int)response.StatusCode}: {body}");
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.GetProperty("errorMessage").GetString() ?? string.Empty;
        }

        /// <summary>Creates a fresh HR account through the API and returns (userId, email).</summary>
        private async Task<(int UserId, string Email)> CreateUserAsync(string token, TestGym gym, string? fullName = null)
        {
            var email = $"wizard-{Guid.NewGuid():N}@test.local".ToLowerInvariant();
            var response = await SendAsync(HttpMethod.Post, "/api/users", new
            {
                fullName = fullName ?? "Sara Hassan",
                email,
                gymIds = new[] { gym.GymId },
            }, token);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            return (data.GetProperty("id").GetInt32(), email);
        }

        // ------------------------------------------------------------------
        // POST /api/users — the HR-Team wizard's final submit (H3)
        // ------------------------------------------------------------------

        [Fact]
        public async Task CreateUser_WithTeamManage_Returns201_WithGymsAndPermissions()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var email = $"wizard-{Guid.NewGuid():N}@test.local".ToLowerInvariant();

            var response = await SendAsync(HttpMethod.Post, "/api/users", new
            {
                fullName = "Sara Hassan",
                email,
                gymIds = new[] { gym.GymId },
                permissions = new[] { "team.view" },
            }, admin);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            var userId = data.GetProperty("id").GetInt32();
            Assert.True(userId > 0);
            Assert.Equal("Sara Hassan", data.GetProperty("name").GetString());
            Assert.Equal("SH", data.GetProperty("initials").GetString());
            Assert.Equal("Active", data.GetProperty("status").GetString());
            Assert.Contains(gym.Name, data.GetProperty("gyms").EnumerateArray().Select(g => g.GetString()));
            Assert.Contains("team.view", data.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()));
            Assert.Equal("HR", data.GetProperty("role").GetString()); // no role assigned yet → falls back to the user-type label

            // The account is login-capable with the standard temporary password.
            var token = await _fixture.LoginAsync(email, "Revive!2026");
            Assert.False(string.IsNullOrWhiteSpace(token));

            // The creation is audited (who / what / target) — never the password.
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "HR Account Created" && a.EntityId == userId));
        }

        [Fact]
        public async Task CreateUser_WithRolePreset_AssignsTheRole()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var roleName = $"WizRole-{Guid.NewGuid():N}";
            var roleResponse = await SendAsync(HttpMethod.Post, "/api/roles",
                new { name = roleName, description = "Created by the wizard test" }, admin);
            Assert.Equal(HttpStatusCode.Created, roleResponse.StatusCode);

            var email = $"preset-{Guid.NewGuid():N}@test.local".ToLowerInvariant();
            var response = await SendAsync(HttpMethod.Post, "/api/users", new
            {
                fullName = "Preset User",
                email,
                gymIds = new[] { gym.GymId },
                rolePreset = roleName,
            }, admin);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.Contains(roleName, data.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
        }

        [Fact]
        public async Task CreateUser_DuplicateEmail_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var payload = new
            {
                fullName = "Dup User",
                email = $"dup-{Guid.NewGuid():N}@test.local".ToLowerInvariant(),
                gymIds = new[] { gym.GymId },
            };

            var first = await SendAsync(HttpMethod.Post, "/api/users", payload, admin);
            Assert.Equal(HttpStatusCode.Created, first.StatusCode);

            var second = await SendAsync(HttpMethod.Post, "/api/users", payload, admin);
            var message = await AssertErrorAsync(second, HttpStatusCode.BadRequest);
            Assert.Contains("already exists", message);
        }

        [Fact]
        public async Task CreateUser_WithoutGymsOrUnknownPermission_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var noGyms = await SendAsync(HttpMethod.Post, "/api/users", new
            {
                fullName = "No Gyms",
                email = $"nogym-{Guid.NewGuid():N}@test.local".ToLowerInvariant(),
            }, admin);
            var noGymsMessage = await AssertErrorAsync(noGyms, HttpStatusCode.BadRequest);
            Assert.Contains("gym", noGymsMessage, StringComparison.OrdinalIgnoreCase);

            var unknownKey = await SendAsync(HttpMethod.Post, "/api/users", new
            {
                fullName = "Bad Keys",
                email = $"badkey-{Guid.NewGuid():N}@test.local".ToLowerInvariant(),
                gymIds = new[] { gym.GymId },
                permissions = new[] { "not.a.real.permission" },
            }, admin);
            var unknownMessage = await AssertErrorAsync(unknownKey, HttpStatusCode.BadRequest);
            Assert.Contains("Unknown permission", unknownMessage);
        }

        [Fact]
        public async Task CreateUser_WithoutTeamManage_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var response = await SendAsync(HttpMethod.Post, "/api/users", new
            {
                fullName = "Nope User",
                email = $"nope-{Guid.NewGuid():N}@test.local".ToLowerInvariant(),
                gymIds = new[] { gym.GymId },
            }, token);

            await AssertErrorAsync(response, HttpStatusCode.Unauthorized);
        }

        // ------------------------------------------------------------------
        // PUT /api/users/{id}/status — suspend / reactivate (H6)
        // ------------------------------------------------------------------

        [Fact]
        public async Task ChangeStatus_Suspend_BlocksLogin_ReactivateRestores()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var (userId, email) = await CreateUserAsync(admin, gym, "Suspender User");

            // Reason is required.
            var missingReason = await SendAsync(HttpMethod.Put, $"/api/users/{userId}/status",
                new { status = "Suspended" }, admin);
            await AssertErrorAsync(missingReason, HttpStatusCode.BadRequest);

            var suspend = await SendAsync(HttpMethod.Put, $"/api/users/{userId}/status",
                new { status = "Suspended", reason = "Left the company" }, admin);
            Assert.Equal(HttpStatusCode.OK, suspend.StatusCode);
            var message = (await suspend.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString();
            Assert.Contains("suspended", message, StringComparison.OrdinalIgnoreCase);

            // Login is refused while suspended.
            var denied = await _fixture.Client.PostAsJsonAsync("/api/auth/login",
                new { email, password = "Revive!2026" });
            Assert.False(denied.IsSuccessStatusCode);

            // Reactivating restores login.
            var reactivate = await SendAsync(HttpMethod.Put, $"/api/users/{userId}/status",
                new { status = "Active", reason = "Rehired" }, admin);
            Assert.Equal(HttpStatusCode.OK, reactivate.StatusCode);
            var token = await _fixture.LoginAsync(email, "Revive!2026");
            Assert.False(string.IsNullOrWhiteSpace(token));

            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "HR Account Suspended" && a.EntityId == userId));
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "HR Account Reactivated" && a.EntityId == userId));
        }

        [Fact]
        public async Task ChangeStatus_SelfSuspend_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "team.manage");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var response = await SendAsync(HttpMethod.Put, $"/api/users/{hr.UserId}/status",
                new { status = "Suspended", reason = "Testing the guard" }, token);

            var message = await AssertErrorAsync(response, HttpStatusCode.BadRequest);
            Assert.Contains("your own account", message);

            // Still active in the database.
            var user = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == hr.UserId);
            Assert.True(user.IsActive);
        }

        [Fact]
        public async Task ChangeStatus_InvalidValue_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var (userId, _) = await CreateUserAsync(admin, gym);

            var response = await SendAsync(HttpMethod.Put, $"/api/users/{userId}/status",
                new { status = "Napping", reason = "Invalid" }, admin);
            await AssertErrorAsync(response, HttpStatusCode.BadRequest);
        }

        // ------------------------------------------------------------------
        // POST /api/users/{id}/reset-password — admin reset (D12)
        // ------------------------------------------------------------------

        [Fact]
        public async Task ResetPassword_SetsKnownPassword_NeverEchoesPlaintext()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var (userId, email) = await CreateUserAsync(admin, gym, "Resettable User");

            var response = await SendAsync(HttpMethod.Post, $"/api/users/{userId}/reset-password",
                new { newPassword = "BrandNewPass123!" }, admin);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // The plaintext never appears in the response.
            var body = await response.Content.ReadAsStringAsync();
            Assert.DoesNotContain("BrandNewPass123!", body);

            // The old temporary password no longer works; the new one does.
            var oldDenied = await _fixture.Client.PostAsJsonAsync("/api/auth/login",
                new { email, password = "Revive!2026" });
            Assert.False(oldDenied.IsSuccessStatusCode);

            var token = await _fixture.LoginAsync(email, "BrandNewPass123!");
            Assert.False(string.IsNullOrWhiteSpace(token));

            // Audited — without the value.
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "HR Account Password Reset" && a.EntityId == userId));
        }

        [Fact]
        public async Task ResetPassword_TooShort_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var (userId, _) = await CreateUserAsync(admin, gym);

            var response = await SendAsync(HttpMethod.Post, $"/api/users/{userId}/reset-password",
                new { newPassword = "short" }, admin);
            await AssertErrorAsync(response, HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task ResetPassword_WithoutTeamManage_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var response = await SendAsync(HttpMethod.Post, $"/api/users/{hr.UserId}/reset-password",
                new { newPassword = "AnotherPass123!" }, token);
            await AssertErrorAsync(response, HttpStatusCode.Unauthorized);
        }
    }
}
