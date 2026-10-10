using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Auth;

namespace Presentation.Controllers
{
    /// <summary>
    /// Web login (email + password → access token) and login-time gym selection.
    /// Both endpoints are anonymous by nature; everything else requires a JWT.
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
    }
}
