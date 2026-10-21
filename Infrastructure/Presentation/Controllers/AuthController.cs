using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Auth;

namespace Presentation.Controllers
{
    /// <summary>
    /// Web login (email + password → access token), the login-time gym selection
    /// flow for employees assigned to multiple gyms (ADR-002), and the signed-in
    /// user's portal profile. Login endpoints are anonymous by nature; the gym
    /// switch requires a valid access token; everything else requires a JWT.
    /// </summary>
    [Route("api/auth")]
    public class AuthController(IAuthService _authService, ISessionContextService _sessionContextService) : ApiControllerBase
    {
        #region Login

        /// <summary>Validates credentials; employees with two or more gyms get a selection challenge.</summary>
        /// <response code="200">Access token issued, or a gym-selection challenge returned.</response>
        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("auth-login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
        {
            var response = await _authService.LoginAsync(request, cancellationToken);
            return Ok(response);
        }

        #endregion

        #region Select Gym

        /// <summary>Completes a multi-gym employee login by choosing the session gym.</summary>
        /// <response code="200">Access token issued, scoped to the chosen gym.</response>
        [HttpPost("login/select-gym")]
        [AllowAnonymous]
        [EnableRateLimiting("auth-login")]
        public async Task<ActionResult<LoginResponse>> SelectGym([FromBody] SelectGymRequest request, CancellationToken cancellationToken)
        {
            var response = await _authService.SelectGymAsync(request, cancellationToken);
            return Ok(response);
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
            return Ok(response);
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
        public async Task<IActionResult> Logout(CancellationToken cancellationToken)
        {
            await _authService.LogoutAsync(GetActorUserId(), cancellationToken);
            return NoContent();
        }

        #endregion
    }
}
