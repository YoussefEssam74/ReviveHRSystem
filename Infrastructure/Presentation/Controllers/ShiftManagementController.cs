using Microsoft.AspNetCore.Mvc;
using Presentation.Authorization;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;
using DomainLayer.Models.UserModule.Enums;

namespace Presentation.Controllers
{
    /// <summary>
    /// Shift/schedule management (mock §§15-16): gym cycles and shift templates.
    /// Gated by the `schedule` feature (View to read, Edit to manage); team-scoped
    /// leaders act on their team's members inside the gym's cycles, Branch Managers
    /// on the whole roster. Publishing makes the cycle visible to employees.
    /// </summary>
    [Route("api/gyms/{gymId}/shift-cycles")]
    public class ShiftCyclesController(IShiftManagementService shiftManagementService) : ApiControllerBase
    {
        [HttpGet]
        [HasFeatureAccess(Features.Schedule, AccessLevel.View)]
        public async Task<ActionResult<IReadOnlyList<ShiftCycleDto>>> GetCycles(
            int gymId, [FromQuery] string? month, CancellationToken cancellationToken)
        {
            var cycles = await shiftManagementService.GetCyclesAsync(
                GetActorUserId(), gymId, month, cancellationToken);
            return Ok(cycles);
        }

        [HttpPost]
        [HasFeatureAccess(Features.Schedule, AccessLevel.Edit)]
        public async Task<ActionResult<ShiftCycleDto>> Create(
            int gymId, CreateShiftCycleDto request, CancellationToken cancellationToken)
        {
            var created = await shiftManagementService.CreateCycleAsync(
                GetActorUserId(), gymId, request, cancellationToken);
            return Created($"/api/gyms/{gymId}/shift-cycles/{created.Id}", created);
        }

        [HttpGet("~/api/gyms/{gymId}/shift-cycles/{cycleId}")]
        [HasFeatureAccess(Features.Schedule, AccessLevel.View)]
        public async Task<ActionResult<ShiftCycleDetailDto>> GetCycle(
            int gymId, int cycleId, CancellationToken cancellationToken)
        {
            var cycle = await shiftManagementService.GetCycleAsync(
                GetActorUserId(), gymId, cycleId, cancellationToken);
            return Ok(cycle);
        }

        [HttpPut("~/api/gyms/{gymId}/shift-cycles/{cycleId}/assignments")]
        [HasFeatureAccess(Features.Schedule, AccessLevel.Edit)]
        public async Task<IActionResult> UpdateAssignments(
            int gymId, int cycleId, UpdateAssignmentsDto request, CancellationToken cancellationToken)
        {
            await shiftManagementService.UpdateAssignmentsAsync(
                GetActorUserId(), gymId, cycleId, request, cancellationToken);
            return NoContent();
        }

        [HttpPost("~/api/gyms/{gymId}/shift-cycles/{cycleId}/publish")]
        [HasFeatureAccess(Features.Schedule, AccessLevel.Edit)]
        public async Task<IActionResult> Publish(int gymId, int cycleId, CancellationToken cancellationToken)
        {
            await shiftManagementService.PublishAsync(GetActorUserId(), gymId, cycleId, cancellationToken);
            return NoContent();
        }

        [HttpDelete("~/api/gyms/{gymId}/shift-cycles/{cycleId}")]
        [HasFeatureAccess(Features.Schedule, AccessLevel.Edit)]
        public async Task<IActionResult> Delete(int gymId, int cycleId, CancellationToken cancellationToken)
        {
            await shiftManagementService.DeleteAsync(GetActorUserId(), gymId, cycleId, cancellationToken);
            return NoContent();
        }
    }

    /// <summary>Reusable shift templates of a gym (mock §16).</summary>
    [Route("api/gyms/{gymId}/shift-templates")]
    public class ShiftTemplatesController(IShiftManagementService shiftManagementService) : ApiControllerBase
    {
        [HttpGet]
        [HasFeatureAccess(Features.Schedule, AccessLevel.View)]
        public async Task<ActionResult<IReadOnlyList<ShiftTemplateDto>>> GetTemplates(
            int gymId, CancellationToken cancellationToken)
        {
            var templates = await shiftManagementService.GetTemplatesAsync(
                GetActorUserId(), gymId, cancellationToken);
            return Ok(templates);
        }

        [HttpPost]
        [HasFeatureAccess(Features.Schedule, AccessLevel.Edit)]
        public async Task<ActionResult<ShiftTemplateDto>> Create(
            int gymId, CreateShiftTemplateDto request, CancellationToken cancellationToken)
        {
            var created = await shiftManagementService.CreateTemplateAsync(
                GetActorUserId(), gymId, request, cancellationToken);
            return Created($"/api/gyms/{gymId}/shift-templates/{created.Id}", created);
        }

        [HttpPut("{templateId}")]
        [HasFeatureAccess(Features.Schedule, AccessLevel.Edit)]
        public async Task<ActionResult<ShiftTemplateDto>> Update(
            int gymId, int templateId, UpdateShiftTemplateDto request, CancellationToken cancellationToken)
        {
            var updated = await shiftManagementService.UpdateTemplateAsync(
                GetActorUserId(), gymId, templateId, request, cancellationToken);
            return Ok(updated);
        }

        [HttpDelete("{templateId}")]
        [HasFeatureAccess(Features.Schedule, AccessLevel.Edit)]
        public async Task<IActionResult> Delete(int gymId, int templateId, CancellationToken cancellationToken)
        {
            await shiftManagementService.DeleteTemplateAsync(GetActorUserId(), gymId, templateId, cancellationToken);
            return NoContent();
        }
    }
}
