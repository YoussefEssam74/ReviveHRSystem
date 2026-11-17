using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Gym;

namespace Presentation.Controllers
{
    /// <summary>Gym directory: the branches the signed-in user may work with.</summary>
    [ApiController]
    [Route("api/gyms")]
    [Authorize]
    public class GymsController(IGymService _gymService) : ApiControllerBase
    {
        #region Get Gyms

        /// <summary>
        /// Lists the gyms visible to the signed-in user: every active gym for Top
        /// Management, the user's assigned gyms otherwise. Each item carries the
        /// branch location and the gym's active staff count.
        /// </summary>
        /// <response code="200">The visible gyms, ordered by name.</response>
        /// <response code="401">Missing, invalid, or inactive account session.</response>
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<GymListResponse>>> GetGyms(CancellationToken cancellationToken)
        {
            var gyms = await _gymService.GetGymsAsync(GetActorUserId(), cancellationToken);
            return Ok(gyms);
        }

        #endregion
    }
}
