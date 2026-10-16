using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Schedule;

namespace Presentation.Controllers
{
    /// <summary>
    /// Shift-template legend (S5, Section 4 S8): the active templates of one gym
    /// with server-derived colors, feeding the calendar legend, the filter chips,
    /// and the Edit Shift select. Template CRUD itself belongs to Organization
    /// settings (out of the HR module's scope). Guards run inside the service.
    /// </summary>
    [Tags("Schedule")]
    [Route("api/gyms/{gymId:int}/shift-templates")]
    [Authorize]
    public class ShiftTemplatesController(IShiftCycleService _service) : ApiControllerBase
    {
        /// <summary>GET /api/gyms/{gymId}/shift-templates — active shift templates ordered by start time (S8, schedule.view).</summary>
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<ShiftTemplateItem>>> GetShiftTemplates(int gymId, CancellationToken cancellationToken)
        {
            var result = await _service.GetShiftTemplatesAsync(GetActorUserId(), gymId, cancellationToken);
            return Ok(result);
        }
    }
}
