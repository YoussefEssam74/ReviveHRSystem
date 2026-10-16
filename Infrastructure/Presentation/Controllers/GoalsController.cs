using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Evaluation;

namespace Presentation.Controllers
{
    /// <summary>Goals &amp; OKRs (api-spec-from-ui.md §5.4, History &amp; Trends tab).</summary>
    [Route("api/goals")]
    [Authorize]
    public class GoalsController(IEvaluationService _service) : ApiControllerBase
    {
        /// <summary>GET /api/goals — paged goal cards (evaluations.view).</summary>
        [HttpGet]
        public async Task<ActionResult<GoalListResponse>> GetGoals([FromQuery] GoalListQuery query, CancellationToken ct)
            => Ok(await _service.GetGoalsAsync(GetActorUserId(), query, ct));

        /// <summary>POST /api/goals — the + Add form (evaluations.manage) → 201.</summary>
        [HttpPost]
        public async Task<ActionResult<GoalResponse>> CreateGoal([FromBody] CreateGoalRequest request, CancellationToken ct)
        {
            var response = await _service.CreateGoalAsync(GetActorUserId(), request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }
    }
}
