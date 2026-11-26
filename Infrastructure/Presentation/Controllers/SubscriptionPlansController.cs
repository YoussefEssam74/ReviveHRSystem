using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Subscription;

namespace Presentation.Controllers
{
    /// <summary>
    /// Subscription plan catalog. Revive Admin manages plans; gym admins can read the
    /// active catalog to request an upgrade. Route: /api/subscription-plans.
    /// </summary>
    [ApiController]
    [Route("api/subscription-plans")]
    [Authorize]
    public class SubscriptionPlansController(ISubscriptionPlanService _planService) : ApiControllerBase
    {
        /// <summary>GET /api/subscription-plans — Revive Admin sees all plans, gym admins see active plans.</summary>
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<SubscriptionPlanDto>>> GetPlans(CancellationToken cancellationToken)
        {
            var plans = await _planService.GetPlansAsync(GetActorUserId(), GetGymIdFromToken(), cancellationToken);
            return Ok(plans);
        }

        /// <summary>POST /api/subscription-plans — creates a catalog plan (Revive Admin).</summary>
        [HttpPost]
        public async Task<ActionResult<SubscriptionPlanDto>> CreatePlan(
            [FromBody] SaveSubscriptionPlanRequest request, CancellationToken cancellationToken)
        {
            var plan = await _planService.CreatePlanAsync(GetActorUserId(), request, cancellationToken);
            return Ok(plan);
        }

        /// <summary>PUT /api/subscription-plans/{planId} — edits a plan or toggles its active flag (Revive Admin).</summary>
        [HttpPut("{planId:int}")]
        public async Task<ActionResult<SubscriptionPlanDto>> UpdatePlan(
            int planId, [FromBody] SaveSubscriptionPlanRequest request, CancellationToken cancellationToken)
        {
            var plan = await _planService.UpdatePlanAsync(GetActorUserId(), planId, request, cancellationToken);
            return Ok(plan);
        }

        /// <summary>DELETE /api/subscription-plans/{planId} — archives a plan; existing gyms keep it.</summary>
        [HttpDelete("{planId:int}")]
        public async Task<IActionResult> ArchivePlan(int planId, CancellationToken cancellationToken)
        {
            await _planService.ArchivePlanAsync(GetActorUserId(), planId, cancellationToken);
            return NoContent();
        }
    }
}
