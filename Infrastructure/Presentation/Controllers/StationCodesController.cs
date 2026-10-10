using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Gym;

namespace Presentation.Controllers
{
    /// <summary>
    /// HR-side management of a gym's station credentials: the short-lived 6-digit
    /// enrollment code kiosks redeem to obtain a station session, and those sessions
    /// themselves. Rotating invalidates the previous code immediately.
    /// </summary>
    [Route("api/gyms/{gymId:int}")]
    [Authorize]
    public class StationCodesController(IStationCodeService _stationCodeService) : ApiControllerBase
    {
        #region Get Current

        /// <summary>Returns the gym's current active enrollment code.</summary>
        /// <response code="200">The active station code for the gym.</response>
        [HttpGet("station-codes")]
        public async Task<ActionResult<StationCodeResponse>> GetCurrent(int gymId, CancellationToken cancellationToken)
        {
            var actorUserId = GetActorUserId();
            var response = await _stationCodeService.GetCurrentAsync(gymId, actorUserId, cancellationToken);
            return Ok(response);
        }

        #endregion

        #region Rotate

        /// <summary>Rotates the enrollment code — new short-lived code issued, old code invalidated.</summary>
        /// <response code="200">The newly issued station code.</response>
        [HttpPost("station-codes")]
        public async Task<ActionResult<StationCodeResponse>> Rotate(int gymId, CancellationToken cancellationToken)
        {
            var response = await _stationCodeService.RotateAsync(gymId, GetActorUserId(), cancellationToken);
            return Ok(response);
        }

        #endregion

        #region Revoke Sessions

        /// <summary>
        /// Revokes every live station session for the gym — enrolled kiosks fall back to
        /// the enrollment screen and must redeem a fresh code. The enrollment codes
        /// themselves are untouched.
        /// </summary>
        /// <response code="200">How many sessions were revoked.</response>
        [HttpDelete("station-sessions")]
        public async Task<ActionResult<StationSessionsRevokedResponse>> RevokeSessions(int gymId, CancellationToken cancellationToken)
        {
            var revokedCount = await _stationCodeService.RevokeStationSessionsAsync(
                gymId, GetActorUserId(), cancellationToken);
            return Ok(new StationSessionsRevokedResponse { RevokedCount = revokedCount });
        }

        #endregion
    }
}
