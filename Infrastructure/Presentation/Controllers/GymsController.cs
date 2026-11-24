using DomainLayer.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
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

        #region Logo

        /// <summary>
        /// Streams the branch logo. Answers 404 when the gym has none stored, which is
        /// how the portal knows to fall back to its bundled brand asset.
        /// </summary>
        /// <response code="200">The stored logo image.</response>
        /// <response code="403">The caller has no access to this gym.</response>
        /// <response code="404">No logo has been uploaded for this gym.</response>
        [HttpGet("{id:int}/logo")]
        public async Task<IActionResult> GetLogo(int id, CancellationToken cancellationToken)
        {
            var file = await _gymService.GetLogoAsync(GetActorUserId(), id, cancellationToken);
            return File(file.Content, file.ContentType);
        }

        /// <summary>
        /// Uploads or replaces the branch logo (PNG, JPG, WEBP or GIF). Reserved for
        /// platform branch management — branch branding is provisioned centrally rather
        /// than by any gym role.
        /// </summary>
        /// <response code="200">The URL that streams the stored logo back.</response>
        /// <response code="400">The upload is missing, not an image, or over the size cap.</response>
        [HttpPut("{id:int}/logo")]
        [RequestSizeLimit(11 * 1024 * 1024)]
        public async Task<ActionResult<GymLogoUploadResult>> UploadLogo(
            int id, IFormFile file, CancellationToken cancellationToken)
        {
            if (file is null || file.Length == 0)
            {
                throw new BadRequestException("A logo file is required.");
            }

            await using var content = file.OpenReadStream();
            var result = await _gymService.UploadLogoAsync(
                GetActorUserId(), id, file.FileName, content, cancellationToken);
            return Ok(result);
        }

        #endregion
    }
}
