using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Evaluation;

namespace Presentation.Controllers
{
    /// <summary>Performance-cycle chips (api-spec-from-ui.md §5.4, History &amp; Trends tab).</summary>
    [Route("api/performance-cycles")]
    [Authorize]
    public class PerformanceCyclesController(IEvaluationService _service) : ApiControllerBase
    {
        /// <summary>GET /api/performance-cycles — cycle windows, newest first (evaluations.view).</summary>
        [HttpGet]
        public async Task<ActionResult<PerformanceCycleResponse>> GetCycles(CancellationToken ct)
            => Ok(await _service.GetPerformanceCyclesAsync(GetActorUserId(), ct));
    }
}
