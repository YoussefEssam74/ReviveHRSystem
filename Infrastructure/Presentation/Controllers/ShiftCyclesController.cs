using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Schedule;

namespace Presentation.Controllers
{
    /// <summary>
    /// Shift cycles (S5, Section 4 S2/S4–S7): cycle detail with the roster grid,
    /// copy-previous, publish, conflict list, and the Edit Shift save. Routes
    /// live under /api/shift-cycles; the per-gym list and create are in
    /// <see cref="GymShiftCyclesController"/>. Gym scoping and the
    /// schedule.view / schedule.manage guards run inside the service (ADR-003).
    /// </summary>
    [Tags("Schedule")]
    [Route("api/shift-cycles")]
    [Authorize]
    public class ShiftCyclesController(IShiftCycleService _service) : ApiControllerBase
    {
        /// <summary>GET /api/shift-cycles/{id} — cycle detail: legend, weekly roster rows (days[0=Mon..6=Sun], null=Off), conflicts (S2, schedule.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<ShiftCycleDetailResponse>> GetShiftCycle(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetShiftCycleAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/shift-cycles/{id}/copy-previous — copies the previous cycle's weekly pattern onto this cycle (S4, schedule.manage).</summary>
        [HttpPost("{id:int}/copy-previous")]
        public async Task<ActionResult<CopyShiftCycleResponse>> CopyPreviousCycle(int id, [FromBody] CopyShiftCycleRequest? request, CancellationToken cancellationToken)
        {
            var result = await _service.CopyPreviousCycleAsync(GetActorUserId(), id, request ?? new CopyShiftCycleRequest(), cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/shift-cycles/{id}/publish — publishes a Draft cycle and notifies scheduled employees (S5, schedule.manage).</summary>
        [HttpPost("{id:int}/publish")]
        public async Task<ActionResult<Shared.DataTransferObject.Employee.MessageResponse>> PublishShiftCycle(int id, CancellationToken cancellationToken)
        {
            var result = await _service.PublishShiftCycleAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/shift-cycles/{id}/conflicts — approved Day Off overlap / cross-gym / out-of-range / inactive-template conflicts (S6, schedule.view).</summary>
        [HttpGet("{id:int}/conflicts")]
        public async Task<ActionResult<ShiftConflictsResponse>> GetShiftCycleConflicts(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetShiftCycleConflictsAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/shift-cycles/{id}/assignments — applies the Edit Shift grid; null shiftTemplateId = Off; Draft cycles only (S7, schedule.manage).</summary>
        [HttpPut("{id:int}/assignments")]
        public async Task<ActionResult<Shared.DataTransferObject.Employee.MessageResponse>> SetShiftAssignments(int id, [FromBody] SetShiftAssignmentsRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.SetShiftAssignmentsAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }
    }
}
