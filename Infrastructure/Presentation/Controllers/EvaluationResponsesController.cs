using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Evaluation;

namespace Presentation.Controllers
{
    /// <summary>Org-wide evaluation history (api-spec-from-ui.md §5.4, History &amp; Trends tab).</summary>
    [Route("api/evaluation-responses")]
    [Authorize]
    public class EvaluationResponsesController(IEvaluationService _service) : ApiControllerBase
    {
        /// <summary>GET /api/evaluation-responses — history rows with answers (evaluations.view).</summary>
        [HttpGet]
        public async Task<ActionResult<EvaluationResponseListResponse>> GetResponses([FromQuery] EvaluationResponseListQuery query, CancellationToken ct)
            => Ok(await _service.GetResponsesAsync(GetActorUserId(), query, ct));
    }
}
