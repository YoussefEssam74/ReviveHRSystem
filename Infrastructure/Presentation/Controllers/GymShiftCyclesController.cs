using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Schedule;

namespace Presentation.Controllers
{
    /// <summary>
    /// Per-gym schedule endpoints (S5, Section 4 S1/S3): the cycle selector
    /// chips and the draft-create action. Complements the per-cycle routes in
    /// <see cref="ShiftCyclesController"/>; both surface under the Swagger
    /// "Schedule" tag. Guards run inside the service (ADR-003).
    /// </summary>
    [Tags("Schedule")]
    [Route("api/gyms/{gymId:int}/shift-cycles")]
    [Authorize]
    public class GymShiftCyclesController(IShiftCycleService _service) : ApiControllerBase
    {
        /// <summary>GET /api/gyms/{gymId}/shift-cycles — all cycles of the gym, newest first (S1, schedule.view).</summary>
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<ShiftCycleListItem>>> GetShiftCycles(int gymId, CancellationToken cancellationToken)
        {
            var result = await _service.GetShiftCyclesAsync(GetActorUserId(), gymId, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/gyms/{gymId}/shift-cycles — creates a Draft cycle; body { label?, startDate, endDate, gymId? } dates yyyy-MM-dd (S3, schedule.manage).</summary>
        [HttpPost]
        public async Task<ActionResult<ShiftCycleDataResponse>> CreateShiftCycle(int gymId, [FromBody] CreateShiftCycleRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateShiftCycleAsync(GetActorUserId(), gymId, request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }
    }
}
