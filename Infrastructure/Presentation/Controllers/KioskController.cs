using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Kiosk;

namespace Presentation.Controllers
{
    /// <summary>
    /// Attendance station (kiosk) login — one of only three [AllowAnonymous] endpoints
    /// (with login and gym selection): it is how a station obtains credentials. The
    /// 6-digit station code is the only credential — no deviceId, no device token —
    /// so replacing broken hardware only requires re-entering the code. On success the
    /// response carries a gym-bound station JWT that every attendance request must
    /// present as a Bearer token.
    /// </summary>
    [Route("api/kiosk")]
    public class KioskController(IAttendanceService _attendanceService) : ApiControllerBase
    {
        #region Login

        /// <summary>Validates the station code and returns the gym context plus a station token.</summary>
        /// <response code="200">Gym context and a gym-bound station token.</response>
        /// <response code="401">Unknown station code, or the gym behind the code is inactive.</response>
        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("station-login")]
        [ProducesResponseType(typeof(StationLoginResponse), StatusCodes.Status200OK)]
        public async Task<ActionResult<StationLoginResponse>> Login([FromBody] StationLoginRequest request, CancellationToken cancellationToken)
        {
            var response = await _attendanceService.StationLoginAsync(request, cancellationToken);
            return Ok(response);
        }

        #endregion
    }
}
