using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using ReviveHRSystem.SecurityTests.Fixtures;
using ReviveHRSystem.SecurityTests.Support;
using Shared.Configuration;
using Xunit;

namespace ReviveHRSystem.SecurityTests
{
    /// <summary>
    /// The JWT attack surface at the ENDPOINT level (the existing JwtAuthentication-
    /// SecurityTests in the integration suite cover the token protocol at /api/auth/me;
    /// here every variant must also fail at the employees surface). Variants:
    /// missing, malformed, wrong-issuer, wrong-audience (covered protocol-sideways),
    /// expired, tampered payload, corrupted signature, wrong key, alg:none, forged
    /// claims from a WRONG key, and the gym-selection token (cross-purpose).
    /// </summary>
    [Trait("Suite", "Jwt")]
    [Collection(SecurityApiFixture.CollectionName)]
    public class JwtEndpointSecurityTests(SecurityApiFixture fixture)
    {
        /// <summary>
        /// Every variant must be rejected by the auth layer itself (401) or flow into
        /// the service guards where convergence rules say 401/404 â€” never 2xx, never 500.
        /// </summary>
        public static TheoryData<string, Func<JwtEndpointSecurityContext, string?>> AttackVariants => new()
        {
            { "missing", _ => null },
            { "empty", _ => string.Empty },
            { "garbage", _ => "not-a-jwt.at.all.really" },
            { "header-only", _ => "Bearer" },
            { "expired", c => JwtForgery.ExpiredToken(c.Settings, c.KarimUserId) },
            { "tampered-payload", c => JwtForgery.TamperedPayloadToken(c.RealToken) },
            { "corrupted-signature", c => JwtForgery.CorruptedSignatureToken(c.RealToken) },
            { "wrong-key", c => JwtForgery.WrongKeyToken(c.Settings, c.KarimUserId) },
            { "alg-none", _ => JwtForgery.AlgNoneToken() },
            { "forged-uid-wrong-key", c => JwtForgery.WrongKeyToken(c.Settings, c.AdminUserId) },
            { "gym-selection-token", c => c.SelectionToken },
        };

        [Theory]
        [MemberData(nameof(AttackVariants))]
        public async Task Attack_Is_Rejected_At_Detail_Endpoint(string variant, Func<JwtEndpointSecurityContext, string?> buildToken)
        {
            var context = await JwtEndpointSecurityContext.CreateAsync(fixture);
            var token = buildToken(context);

            var url = $"/api/employees/{fixture.Context.KarimEmployeeId}";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(token))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }

            var response = await fixture.Client.SendAsync(request);
            var status = (int)response.StatusCode;

            Assert.True(status is 401 or 404,
                $"JWT attack variant '{variant}' reached the employee detail endpoint: {status}. " +
                "Non-2xx and non-500 required (401 protocol-layer rejection or 404 service-guard)." +
                (variant == "gym-selection-token"
                    ? " This is the known JWT-001 finding (selection token minted with the " +
                      "access-token issuer/audience â€” see " +
                      "JwtAuthenticationSecurityTests.Me_SelectionToken_MustNotActAsAccessToken)."
                    : string.Empty));
        }
        [Fact]
        public async Task AlgNone_Is_Rejected_As_Default_Deny_In_Listing_Too()
        {
            var context = await JwtEndpointSecurityContext.CreateAsync(fixture);
            using var request = new HttpRequestMessage(HttpMethod.Get, "/api/employees");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", JwtForgery.AlgNoneToken());
            var response = await fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Real_Token_Still_Works_After_Attack_Theories()
        {
            var token = await fixture.GetTokenAsync(fixture.Context.EmployeeSelf);
            using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/employees/{fixture.Context.KarimEmployeeId}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var response = await fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    /// <summary>Per-run context for the attack theory (settings + a real token).</summary>
    public sealed class JwtEndpointSecurityContext
    {
        public required JwtSettings Settings { get; init; }
        public required string RealToken { get; init; }
        public required string SelectionToken { get; init; }
        public required int KarimUserId { get; init; }
        public required int AdminUserId { get; init; }

        public static async Task<JwtEndpointSecurityContext> CreateAsync(SecurityApiFixture fixture)
        {
            using var scope = fixture.NewScope();
            // The host registers the concrete JwtSettings singleton (Program.cs).
            var settings = scope.ServiceProvider.GetRequiredService<JwtSettings>();
            var tokenService = scope.ServiceProvider.GetRequiredService<ServiceAbstraction.Services.ITokenService>();

            var realToken = await fixture.GetTokenAsync(fixture.Context.EmployeeSelf);

            // A real, correctly-signed gym-SELECTION token (distinct "gym-selection"
            // audience per ADR-002). It must NEVER satisfy the bearer access-token
            // validation â€” the purpose-separation guarantee under test.
            var selectionToken = tokenService.CreateGymSelectionToken(fixture.Context.KarimUserId);

            return new JwtEndpointSecurityContext
            {
                Settings = settings,
                RealToken = realToken,
                SelectionToken = selectionToken,
                KarimUserId = fixture.Context.KarimUserId,
                AdminUserId = fixture.Context.TopManagementUserId,
            };
        }
    }
}
