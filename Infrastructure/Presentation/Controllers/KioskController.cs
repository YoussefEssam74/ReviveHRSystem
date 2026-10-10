using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ServiceAbstraction.Services;
using Shared.Configuration;
using Shared.DataTransferObject.Kiosk;

namespace Presentation.Controllers
{
    /// <summary>
    /// Attendance station (kiosk) session lifecycle: enrollment and logout are
    /// [AllowAnonymous] because they are how a station obtains and ends credentials. The
    /// 6-digit enrollment code is the only credential — no deviceId, no device token —
    /// so replacing broken hardware only requires redeeming a fresh code. On success the
    /// opaque, gym-bound station session token is returned once in the response body and
    /// persisted in an HttpOnly cookie, so the kiosk SPA is silently restored after a
    /// reload or machine reboot without any client-side token storage. The
    /// X-Station-Token header remains supported for non-browser clients.
    /// </summary>
    [Route("api/kiosk")]
    public class KioskController(
        IAttendanceService _attendanceService,
        IStationSessionService _stationSessions) : ApiControllerBase
    {
        #region Login

        /// <summary>Validates the enrollment code and returns the gym context plus a station session token.</summary>
        /// <response code="200">Gym context and the station session token (also persisted as an HttpOnly cookie).</response>
        /// <response code="401">Unknown, rotated, or expired station code, or the gym behind the code is inactive.</response>
        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("station-login")]
        public async Task<ActionResult<StationLoginResponse>> Login([FromBody] StationLoginRequest request, CancellationToken cancellationToken)
        {
            var response = await _attendanceService.StationLoginAsync(request, cancellationToken);

            if (!string.IsNullOrEmpty(response.Token))
            {
                // HttpOnly cookie: the browser stores the token; React never sees or
                // stores it, and GET /api/kiosk/session restores the kiosk after reloads.
                Response.Cookies.Append(
                    StationSessionOptions.SessionCookieName,
                    response.Token,
                    new CookieOptions
                    {
                        HttpOnly = true,
                        Secure = Request.IsHttps,
                        SameSite = SameSiteMode.Lax,
                        Path = "/",
                        Expires = response.SessionExpiresAtUtc
                    });
            }

            return Ok(response);
        }

        #endregion

        #region Session restore

        /// <summary>
        /// Restores the station session from the HttpOnly cookie when the kiosk SPA loads,
        /// so a rebooted machine lands straight on the connected dashboard. The
        /// X-Station-Token header is accepted as well for non-browser clients.
        /// </summary>
        /// <response code="200">Gym context and expiry of the live session.</response>
        /// <response code="401">No valid station session — the station must re-enroll with a code.</response>
        [HttpGet("session")]
        public async Task<ActionResult<StationSessionResponse>> GetSession(CancellationToken cancellationToken)
        {
            var token = ReadStationToken();
            if (token is null)
            {
                return Unauthorized();
            }

            var session = await _stationSessions.ValidateSessionAsync(token, cancellationToken);
            if (session is null)
            {
                return Unauthorized();
            }

            return Ok(new StationSessionResponse
            {
                GymId = session.GymId,
                GymName = session.Gym?.Name ?? string.Empty,
                SessionExpiresAtUtc = session.ExpiresAtUtc
            });
        }

        #endregion

        #region Logout

        /// <summary>
        /// Revokes the kiosk's live station session (when one is presented) and always
        /// clears the session cookie. Anonymous so a stale cookie can always be cleared;
        /// an invalid or expired session simply leaves nothing to revoke.
        /// </summary>
        /// <response code="204">Cookie cleared; any live session behind it was revoked.</response>
        [HttpPost("logout")]
        [AllowAnonymous]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> Logout(CancellationToken cancellationToken)
        {
            var token = ReadStationToken();
            if (token is not null)
            {
                var session = await _stationSessions.ValidateSessionAsync(token, cancellationToken);
                if (session is not null)
                {
                    await _stationSessions.RevokeSessionAsync(session.Id, cancellationToken);
                }
            }

            // Path must match the login cookie's Path, or browsers keep the old cookie.
            Response.Cookies.Delete(
                StationSessionOptions.SessionCookieName,
                new CookieOptions { Path = "/" });
            return NoContent();
        }

        #endregion

        /// <summary>Station session token from the X-Station-Token header, falling back to the session cookie.</summary>
        private string? ReadStationToken()
        {
            if (Request.Headers.TryGetValue(StationSessionOptions.SessionHeaderName, out var headerValues))
            {
                var headerToken = headerValues.ToString();
                if (!string.IsNullOrWhiteSpace(headerToken))
                {
                    return headerToken;
                }
            }

            return Request.Cookies.TryGetValue(StationSessionOptions.SessionCookieName, out var cookieToken)
                && !string.IsNullOrWhiteSpace(cookieToken)
                    ? cookieToken
                    : null;
        }
    }
}
