using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Auth;

namespace Presentation.Controllers
{
    /// <summary>
    /// Web login (email + password → access token), login-time gym selection, and the
    /// signed-in user's portal profile. Login endpoints are anonymous by nature;
    /// /me requires a JWT.
    /// </summary>
    [Route("api/auth")]
    public class AuthController(IAuthService _authService) : ApiControllerBase
    {
        #region Login

        /// <summary>Validates credentials; employees with two gyms get a selection challenge.</summary>
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

        /// <summary>Completes a two-gym employee login by choosing the session gym.</summary>
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
    }
}
