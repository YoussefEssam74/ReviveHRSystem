using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Http;
using Shared.Configuration;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Auth;

namespace Presentation.Controllers
{
    /// <summary>
    /// Web login (email + password → HttpOnly access/refresh cookies), the login-time gym selection
    /// flow for employees assigned to multiple gyms (ADR-002), and the signed-in
    /// user's portal profile. Login endpoints are anonymous by nature; the gym
    /// switch requires a valid access token; everything else requires a JWT.
    /// </summary>
    [Route("api/auth")]
    public class AuthController(
        IAuthService _authService,
        ISessionContextService _sessionContextService,
        IAntiforgery antiforgery) : ApiControllerBase
    {
        [HttpGet("csrf")]
        [AllowAnonymous]
        public IActionResult GetCsrfToken()
        {
            var tokens = antiforgery.GetAndStoreTokens(HttpContext);
            return Ok(new { requestToken = tokens.RequestToken });
        }

        #region Login

        /// <summary>Validates credentials; employees with two or more gyms get a selection challenge.</summary>
        /// <response code="200">Browser cookies issued, or a gym-selection challenge returned.</response>
        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("auth-login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
        {
            var response = await _authService.LoginAsync(request, cancellationToken);
            SetAuthCookies(response.AccessToken, response.ExpiresInSeconds, response.RefreshToken, response.RefreshExpiresInSeconds);
            return Ok(HideBrowserTokens(response));
        }

        #endregion

        #region Select Gym

        /// <summary>Completes a multi-gym employee login by choosing the session gym.</summary>
        /// <response code="200">Browser cookies issued, scoped to the chosen gym.</response>
        [HttpPost("login/select-gym")]
        [AllowAnonymous]
        [EnableRateLimiting("auth-login")]
        public async Task<ActionResult<LoginResponse>> SelectGym([FromBody] SelectGymRequest request, CancellationToken cancellationToken)
        {
            var response = await _authService.SelectGymAsync(request, cancellationToken);
            SetAuthCookies(response.AccessToken, response.ExpiresInSeconds, response.RefreshToken, response.RefreshExpiresInSeconds);
            return Ok(HideBrowserTokens(response));
        }

        #endregion

        #region Switch Gym

        /// <summary>
        /// Switches the active gym of the current session (ADR-002 Amendment 1).
        /// The gym must be in the caller's UserGymAccess and active; the returned
        /// access token is scoped to the new gym and the payload carries the
        /// refreshed per-gym feature levels.
        /// </summary>
        /// <response code="200">New token + refreshed session context.</response>
        /// <response code="401">Session invalid, or the caller has no access to the gym.</response>
        [HttpPost("switch-gym")]
        [EnableRateLimiting("auth-login")]
        public async Task<ActionResult<SwitchGymResponse>> SwitchGym([FromBody] SwitchGymRequest request, CancellationToken cancellationToken)
        {
            var userId = GetActorUserId();
            var response = await _sessionContextService.SwitchGymAsync(userId, request.GymId, cancellationToken);
            SetAuthCookies(response.AccessToken, response.ExpiresInSeconds, response.RefreshToken, response.RefreshExpiresInSeconds);
            return Ok(IsBrowserRequest()
                ? new SwitchGymResponse { ExpiresInSeconds = response.ExpiresInSeconds, Me = response.Me }
                : response);
        }

        #endregion

        #region Current User

        /// <summary>
        /// The signed-in user's portal profile: identity, derived name pieces, position,
        /// assigned gyms, the token's selected gym, and granted permission keys.
        /// </summary>
        /// <response code="200">The current user's profile.</response>
        /// <response code="401">Missing, invalid, or inactive account session.</response>
        [HttpGet("me")]
        [Authorize]
        public async Task<ActionResult<CurrentUserResponse>> GetCurrentUser(CancellationToken cancellationToken)
        {
            var gymIdFromToken = GetGymIdFromToken();
            var response = await _authService.GetCurrentUserAsync(
                GetActorUserId(),
                gymIdFromToken > 0 ? gymIdFromToken : null,
                cancellationToken);
            return Ok(response);
        }

        #endregion

        #region Refresh

        /// <summary>Exchanges a valid refresh token for a new access token and a rotated refresh token.</summary>
        /// <response code="200">Rotated HttpOnly cookies issued.</response>
        /// <response code="401">Refresh token missing, invalid, expired, or revoked.</response>
        [HttpPost("refresh")]
        [AllowAnonymous]
        [EnableRateLimiting("auth-login")]
        public async Task<ActionResult<LoginResponse>> Refresh([FromBody] RefreshRequest? request, CancellationToken cancellationToken)
        {
            var refreshToken = Request.Cookies.TryGetValue(AuthCookieOptions.RefreshTokenCookie, out var cookieToken)
                ? cookieToken
                : request?.RefreshToken ?? string.Empty;
            var response = await _authService.RefreshAsync(refreshToken, cancellationToken);
            SetAuthCookies(response.AccessToken, response.ExpiresInSeconds, response.RefreshToken, response.RefreshExpiresInSeconds);
            return Ok(HideBrowserTokens(response));
        }

        #endregion

        #region Logout

        /// <summary>
        /// Ends the caller's web session. Access-token-only auth means there is no
        /// server-side session to revoke (ADR-002) — the client discards its token and
        /// the token's own lifetime ends the session — so this records an audit entry
        /// and returns 204. It is idempotent: an already-invalid token is a no-op here
        /// and is answered by the framework's 401 before reaching the handler.
        /// </summary>
        /// <response code="204">Logout recorded.</response>
        /// <response code="401">No valid session.</response>
        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout([FromBody] RefreshRequest? request, CancellationToken cancellationToken)
        {
            int? actorId = int.TryParse(User.FindFirst("uid")?.Value ?? User.FindFirst("sub")?.Value, out var userId)
                ? userId
                : null;
            var refreshToken = Request.Cookies.TryGetValue(AuthCookieOptions.RefreshTokenCookie, out var cookieToken)
                ? cookieToken
                : request?.RefreshToken;
            await _authService.LogoutAsync(actorId, refreshToken, cancellationToken);
            if (Request.Cookies.TryGetValue(AuthCookieOptions.ConsoleRefreshTokenCookie, out var parkedRefresh))
            {
                await _authService.LogoutAsync(null, parkedRefresh, cancellationToken);
            }
            ClearAuthCookies();
            return NoContent();
        }

        private bool IsBrowserRequest() => Request.Headers.ContainsKey("Origin");

        private LoginResponse HideBrowserTokens(LoginResponse response) => !IsBrowserRequest()
            ? response
            : new LoginResponse
            {
                ExpiresInSeconds = response.ExpiresInSeconds,
                RefreshExpiresInSeconds = response.RefreshExpiresInSeconds,
                User = response.User,
                RequiresGymSelection = response.RequiresGymSelection,
                Gyms = response.Gyms,
                TempSessionToken = response.TempSessionToken,
            };

        private void SetAuthCookies(string? accessToken, int? accessSeconds, string? refreshToken, int? refreshSeconds)
        {
            if (!string.IsNullOrWhiteSpace(accessToken))
            {
                Response.Cookies.Append(AuthCookieOptions.AccessTokenCookie, accessToken, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = IsSecureCookieRequest(),
                    SameSite = CookieSameSite(),
                    Path = "/",
                    Expires = DateTimeOffset.UtcNow.AddSeconds(Math.Max(60, accessSeconds ?? 3600)),
                });
            }

            if (!string.IsNullOrWhiteSpace(refreshToken))
            {
                Response.Cookies.Append(AuthCookieOptions.RefreshTokenCookie, refreshToken, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = IsSecureCookieRequest(),
                    SameSite = CookieSameSite(),
                    Path = "/",
                    Expires = DateTimeOffset.UtcNow.AddSeconds(Math.Max(60, refreshSeconds ?? 30 * 24 * 3600)),
                });
            }
        }

        private void ClearAuthCookies()
        {
            Response.Cookies.Delete(AuthCookieOptions.AccessTokenCookie, new CookieOptions { Path = "/" });
            Response.Cookies.Delete(AuthCookieOptions.RefreshTokenCookie, new CookieOptions { Path = "/" });
            Response.Cookies.Delete(AuthCookieOptions.ConsoleAccessTokenCookie, new CookieOptions { Path = "/" });
            Response.Cookies.Delete(AuthCookieOptions.ConsoleRefreshTokenCookie, new CookieOptions { Path = "/" });
        }

        private bool IsSecureCookieRequest() => Request.IsHttps
            || Request.Host.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
            || Request.Host.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase);

        private SameSiteMode CookieSameSite()
        {
            var origin = Request.Headers.Origin.ToString();
            return Uri.TryCreate(origin, UriKind.Absolute, out var uri)
                && !uri.Host.Equals(Request.Host.Host, StringComparison.OrdinalIgnoreCase)
                    ? SameSiteMode.None
                    : SameSiteMode.Lax;
        }

        #endregion
    }
}
