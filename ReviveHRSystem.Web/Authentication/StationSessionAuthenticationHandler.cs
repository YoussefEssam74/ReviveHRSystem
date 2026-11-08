using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ServiceAbstraction.Services;
using Shared.Configuration;

namespace ReviveHRSystem.Web.Authentication
{
    /// <summary>Authentication scheme name for station (kiosk) session tokens.</summary>
    public static class StationSessionAuthentication
    {
        public const string SchemeName = "StationSession";

        /// <summary>Header carrying the station session token (single source: Shared.Configuration).</summary>
        public const string TokenHeader = StationSessionOptions.SessionHeaderName;

        /// <summary>Claim carrying the validated session's id.</summary>
        public const string SessionIdClaim = "sid";

        /// <summary>Claim value that marks a station-session identity.</summary>
        public const string StationPurpose = "station";
    }

    /// <summary>
    /// Authenticates attendance stations (kiosks) with the opaque session token issued by
    /// POST /api/kiosk/login. The token is validated against the database-backed session
    /// (hash lookup + expiry/revocation + active gym), and the resulting identity carries
    /// gymId and sid claims read from that record — so no client-supplied value can ever
    /// define the gym binding. The token is read from the X-Station-Token header first,
    /// falling back to the HttpOnly session cookie the kiosk SPA is enrolled with; a
    /// request without either yields <see cref="AuthenticateResult.NoResult"/> so
    /// user-JWT authentication still applies; a present-but-invalid token fails.
    /// </summary>
    public sealed class StationSessionAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IStationSessionService stationSessions)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            // Header first (explicit wins), then the HttpOnly session cookie — the kiosk
            // SPA never touches the token itself; the browser sends the cookie.
            string? token = null;
            var tokenFromCookie = false;
            if (Request.Headers.TryGetValue(StationSessionAuthentication.TokenHeader, out var headerValues))
            {
                token = headerValues.ToString();
                if (string.IsNullOrWhiteSpace(token))
                {
                    return AuthenticateResult.Fail("Station session token is empty.");
                }
            }
            else if (Request.Cookies.TryGetValue(StationSessionOptions.SessionCookieName, out var cookieToken)
                     && !string.IsNullOrWhiteSpace(cookieToken))
            {
                token = cookieToken;
                tokenFromCookie = true;
            }

            if (string.IsNullOrWhiteSpace(token))
            {
                // No station credential presented — other schemes (user JWT) decide.
                return AuthenticateResult.NoResult();
            }

            DomainLayer.Models.AttendanceModule.StationSession? session;
            try
            {
                session = await stationSessions.ValidateSessionAsync(token, Context.RequestAborted);
            }
            catch (OperationCanceledException) when (Context.RequestAborted.IsCancellationRequested)
            {
                // The request itself was aborted (client hung up mid-validation) — that
                // is not a validation failure: let the pipeline tear down normally.
                throw;
            }
            catch (Exception exception)
            {
                Logger.LogError(exception, "Validating a station session token failed.");
                return AuthenticateResult.Fail("Station session token could not be validated.");
            }

            if (session is null)
            {
                // The presented token is unknown, expired, or revoked. Drop the
                // (possibly stale) HttpOnly cookie so the kiosk stops presenting a
                // dead token and can fall back to the enrollment screen instead of
                // looping 401s on every subsequent request — but only when the
                // failing token came from the cookie: an invalid header token must
                // not destroy a still-valid cookie session.
                if (tokenFromCookie && Request.Cookies.ContainsKey(StationSessionOptions.SessionCookieName))
                {
                    Response.Cookies.Delete(
                        StationSessionOptions.SessionCookieName,
                        new CookieOptions { Path = "/" });
                }

                return AuthenticateResult.Fail("Station session is unknown, expired, or revoked.");
            }

            var identity = new ClaimsIdentity(
                new[]
                {
                    new Claim("gymId", session.GymId.ToString()),
                    new Claim(StationSessionAuthentication.SessionIdClaim, session.Id.ToString()),
                    new Claim("purpose", StationSessionAuthentication.StationPurpose),
                },
                Scheme.Name);

            return AuthenticateResult.Success(
                new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
        }
    }
}
