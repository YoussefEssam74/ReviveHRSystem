using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Gym;

namespace Presentation.Controllers
{
    /// <summary>
    /// HR-side management of a gym's 6-digit station code (the credential attendance
    /// stations use to log in). Rotating invalidates the previous code immediately.
    /// </summary>
    [Route("api/gyms/{gymId:int}/station-codes")]
    [Authorize]
    public class StationCodesController(IStationCodeService _stationCodeService) : ApiControllerBase
    {
        #region Get Current

        /// <summary>Returns the gym's current active station code.</summary>
        /// <response code="200">The active station code for the gym.</response>
        [HttpGet]
        [ProducesResponseType(typeof(StationCodeResponse), StatusCodes.Status200OK)]
        public async Task<ActionResult<StationCodeResponse>> GetCurrent(int gymId, CancellationToken cancellationToken)
        {
            var actorUserId = GetActorUserId();
            var response = await _stationCodeService.GetCurrentAsync(gymId, actorUserId, cancellationToken);
            return Ok(response);
        }

        #endregion

        #region Rotate

        /// <summary>Rotates the station code — new code issued, old code invalidated.</summary>
        /// <response code="200">The newly issued station code.</response>
        [HttpPost]
        [ProducesResponseType(typeof(StationCodeResponse), StatusCodes.Status200OK)]
        public async Task<ActionResult<StationCodeResponse>> Rotate(int gymId, CancellationToken cancellationToken)
        {
            var response = await _stationCodeService.RotateAsync(gymId, GetActorUserId(), cancellationToken);
            return Ok(response);
        }

        #endregion
    }
}
