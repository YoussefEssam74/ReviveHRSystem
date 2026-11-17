using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Evaluation;

namespace Presentation.Controllers
{
    /// <summary>
    /// The signed-in evaluator's inbox (api-spec-from-ui.md §5.4): assignment cards
    /// grouped per form with subject chips and progress. Holds any of the four
    /// evaluator keys (evaluations.manage | .manage.team | .view.team | team.manage).
    /// </summary>
    [Route("api/evaluation-assignments")]
    [Authorize]
    public class EvaluationAssignmentsController(IEvaluationService _service) : ApiControllerBase
    {
        /// <summary>GET /api/evaluation-assignments — MY EVALUATIONS cards for the caller.</summary>
        [HttpGet]
        public async Task<ActionResult<AssignmentListResponse>> GetAssignments([FromQuery] AssignmentListQuery query, CancellationToken ct)
            => Ok(await _service.GetAssignmentsAsync(GetActorUserId(), query, ct));
    }
}
