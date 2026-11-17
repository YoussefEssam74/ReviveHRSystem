using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Presentation.Controllers
{
    /// <summary>
    /// Shift/schedule management (mock §§15-16): gym cycles and shift templates.
    /// Gated by the `schedule` feature (View to read, Edit to manage); team-scoped
    /// leaders act on their team's members inside the gym's cycles, Branch Managers
    /// on the whole roster. Publishing makes the cycle visible to employees.
    /// The gym-level list/create verbs live in the HR schedule controllers
    /// (GymShiftCyclesController / ShiftTemplatesController); this surface owns the
    /// per-cycle and per-template operations.
    /// </summary>
    [Route("api/gyms/{gymId}/shift-cycles")]
    public class ShiftCycleManagementController(IShiftManagementService shiftManagementService) : ApiControllerBase
    {
        [HttpGet("~/api/gyms/{gymId}/shift-cycles/{cycleId}")]
        public async Task<ActionResult<ShiftCycleDetailDto>> GetCycle(
            int gymId, int cycleId, CancellationToken cancellationToken)
        {
            EnsureGymScope(gymId);
            var cycle = await shiftManagementService.GetCycleAsync(
                GetActorUserId(), gymId, cycleId, cancellationToken);
            return Ok(cycle);
        }

        [HttpPut("~/api/gyms/{gymId}/shift-cycles/{cycleId}/assignments")]
        public async Task<IActionResult> UpdateAssignments(
            int gymId, int cycleId, UpdateAssignmentsDto request, CancellationToken cancellationToken)
        {
            EnsureGymScope(gymId);
            await shiftManagementService.UpdateAssignmentsAsync(
                GetActorUserId(), gymId, cycleId, request, cancellationToken);
            return NoContent();
        }

        [HttpPost("~/api/gyms/{gymId}/shift-cycles/{cycleId}/publish")]
        public async Task<IActionResult> Publish(int gymId, int cycleId, CancellationToken cancellationToken)
        {
            EnsureGymScope(gymId);
            await shiftManagementService.PublishAsync(GetActorUserId(), gymId, cycleId, cancellationToken);
            return NoContent();
        }

        [HttpDelete("~/api/gyms/{gymId}/shift-cycles/{cycleId}")]
        public async Task<IActionResult> Delete(int gymId, int cycleId, CancellationToken cancellationToken)
        {
            EnsureGymScope(gymId);
            await shiftManagementService.DeleteAsync(GetActorUserId(), gymId, cycleId, cancellationToken);
            return NoContent();
        }
    }

    /// <summary>Reusable shift templates of a gym (mock §16).</summary>
    [Route("api/gyms/{gymId}/shift-templates")]
    public class ShiftTemplateManagementController(IShiftManagementService shiftManagementService) : ApiControllerBase
    {
        [HttpPost]
        public async Task<ActionResult<ShiftTemplateDto>> Create(
            int gymId, CreateShiftTemplateDto request, CancellationToken cancellationToken)
        {
            EnsureGymScope(gymId);
            var created = await shiftManagementService.CreateTemplateAsync(
                GetActorUserId(), gymId, request, cancellationToken);
            return Created($"/api/gyms/{gymId}/shift-templates/{created.Id}", created);
        }

        [HttpPut("{templateId}")]
        public async Task<ActionResult<ShiftTemplateDto>> Update(
            int gymId, int templateId, UpdateShiftTemplateDto request, CancellationToken cancellationToken)
        {
            EnsureGymScope(gymId);
            var updated = await shiftManagementService.UpdateTemplateAsync(
                GetActorUserId(), gymId, templateId, request, cancellationToken);
            return Ok(updated);
        }

        [HttpDelete("{templateId}")]
        public async Task<IActionResult> Delete(int gymId, int templateId, CancellationToken cancellationToken)
        {
            EnsureGymScope(gymId);
            await shiftManagementService.DeleteTemplateAsync(GetActorUserId(), gymId, templateId, cancellationToken);
            return NoContent();
        }
    }
}
