using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using ServiceAbstraction.Services;
using Shared.Configuration;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Token-level security for the JWT surface: every request that presents
    /// anything other than a perfectly valid access token for an active, existing
    /// user must be rejected with 401. Issuer, audience, signature, lifetime and
    /// the selection-token audience separation are all part of the contract
    /// (ADR-002); this suite pins it down at the HTTP boundary.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class JwtAuthenticationSecurityTests
    {
        private const string ProtectedUrl = "/api/auth/me";

        private readonly ApiTestFixture _fixture;
        private readonly TestDataBuilder _builder;

        public JwtAuthenticationSecurityTests(ApiTestFixture fixture)
        {
            _fixture = fixture;
            _builder = new TestDataBuilder(fixture.Services);
        }

        [Fact]
        public async Task Me_MissingToken_Returns401()
        {
            var response = await _fixture.Client.GetAsync(ProtectedUrl);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Me_MalformedToken_Returns401()
        {
            var response = await SendAsync("this-is-not-a-jwt");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Me_TamperedSignature_Returns401()
        {
            // Real token, then flip one character of the signature segment.
            var token = await _fixture.GetAdminTokenAsync();
            var parts = token.Split('.');
            Assert.Equal(3, parts.Length);
            var corruptedSignature = parts[2][0] == 'A' ? "B" + parts[2].Substring(1) : "A" + parts[2].Substring(1);

            var response = await SendAsync($"{parts[0]}.{parts[1]}.{corruptedSignature}");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Me_ExpiredToken_Returns401()
        {
            // Valid claims + valid signature, expired 10 minutes ago: the lifetime
            // check must reject it (ClockSkew 30s gives no slack for -10 min).
            var token = CreateToken(
                claims: ForgedClaims(),
                minutesFromNow: -10);

            var response = await SendAsync(token);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Me_WrongIssuer_Returns401()
        {
            var token = CreateForgedToken(issuer: "NotReviveHRSystem");
            var response = await SendAsync(token);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Me_WrongAudience_Returns401()
        {
            var token = CreateForgedToken(audience: "ReviveHRSystemClient-WRONG");
            var response = await SendAsync(token);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Me_SelectionToken_MustNotActAsAccessToken()
        {
            // ADR-002 intent: the gym-selection challenge token may NEVER satisfy
            // the main JwtBearer handler - it exists solely for the select-gym
            // step. If this test fails, `tempSessionToken` is bypassing the
            // selection gate and acting as a 5-minute access token.
            using var scope = _fixture.Services.CreateScope();
            var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
            var selectionToken = tokenService.CreateGymSelectionToken(userId: 1);

            var response = await SendAsync(selectionToken);
            if (response.StatusCode == HttpStatusCode.OK)
            {
                Assert.Fail("SECURITY FINDING (JWT-001): the gym-selection token was accepted as an " +
                    "access token by a protected endpoint because it is minted with the same issuer/audience" +
                    "as access tokens. ADR-002 requires audience separation; fix TokenService.CreateSignedToken" +
                    "to use a dedicated selection audience.");
            }
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Me_WrongSigningKey_Returns401()
        {
            // Perfect claims, wrong key: signature forgery defense.
            var otherKey = Encoding.UTF8.GetBytes(new string('^', 40));
            var token = CreateToken(
                claims: ForgedClaims(),
                minutesFromNow: 30,
                signingKey: otherKey);

            var response = await SendAsync(token);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Me_ForgedUidOfNonexistentUser_Returns401()
        {
            // Valid signature + claims, but the actor does not exist in the DB:
            // the access-control fallback must still refuse the request.
            var token = CreateForgedToken();
            var response = await SendAsync(token);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Me_DeactivatedUserWithValidToken_Returns401()
        {
            // Token minted while the account was active, then the account is
            // deactivated: live actor checks must refuse the session.
            var gym = await _builder.CreateGymWithStationAsync();
            var user = await _builder.CreateUserAsync(UserType.Employee, new[] { gym });

            using var scope = _fixture.Services.CreateScope();
            var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
            var dbUser = await LoadUserAsync(user.UserId);
            var token = tokenService.CreateAccessToken(dbUser, Enumerable.Empty<string>(), gym.GymId);

            await _builder.SetUserActiveAsync(user.UserId, isActive: false);

            var response = await SendAsync(token);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Me_ValidSeededAdminToken_Returns200()
        {
            // Control case: the real login flow keeps working.
            var token = await _fixture.GetAdminTokenAsync();
            var response = await SendAsync(token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        // ------------------------------------------------------------------

        private async Task<HttpResponseMessage> SendAsync(string bearerToken)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, ProtectedUrl);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
            return await _fixture.Client.SendAsync(request);
        }

        private static Dictionary<string, string> ForgedClaims() => new()
        {
            ["uid"] = "999999999",
            ["email"] = "forged@revive.hr",
            ["name"] = "forged"
        };

        private JwtSettings GetSettings() =>
            _fixture.Services.GetRequiredService<JwtSettings>();

        private async Task<DomainLayer.Models.UserModule.User> LoadUserAsync(int userId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Users.FindAsync(userId);
        }

        /// <summary>Mints a JWT with the pipeline's real claims defaults but overridable issuer/audience/key.</summary>
        private string CreateForgedToken(string? issuer = null, string? audience = null)
        {
            return CreateToken(claims: ForgedClaims(), minutesFromNow: 30, issuer: issuer, audience: audience);
        }

        private string CreateToken(
            Dictionary<string, string> claims,
            int minutesFromNow,
            string? issuer = null,
            string? audience = null,
            byte[]? signingKey = null)
        {
            var settings = GetSettings();
            var handler = new JwtSecurityTokenHandler();
            var credentials = new SigningCredentials(
                new SymmetricSecurityKey(signingKey ?? Encoding.UTF8.GetBytes(settings.Key)),
                SecurityAlgorithms.HmacSha256);

            var securityToken = new JwtSecurityToken(
                issuer: issuer ?? settings.Issuer,
                audience: audience ?? settings.Audience,
                claims: claims.Select(c => new Claim(c.Key, c.Value)),
                notBefore: DateTime.UtcNow.AddMinutes(-30),
                expires: DateTime.UtcNow.AddMinutes(minutesFromNow),
                signingCredentials: credentials);

            return handler.WriteToken(securityToken);
        }
    }
}
