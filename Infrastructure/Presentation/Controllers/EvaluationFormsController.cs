using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Evaluation;

namespace Presentation.Controllers
{
    /// <summary>
    /// Evaluation forms + the run pipeline (api-spec-from-ui.md §5.3/§5.4): the
    /// form-builder CRUD for evaluation templates, evaluator dispatch, cycle
    /// launching, and the submission endpoint behind both free-run and assigned
    /// modes. Hiring-form CRUD lives on HiringFormsController.
    /// </summary>
    [Route("api/evaluation-forms")]
    [Authorize]
    public class EvaluationFormsController(IEvaluationService _service) : ApiControllerBase
    {
        /// <summary>GET /api/evaluation-forms — form cards with question lists (evaluations.view).</summary>
        [HttpGet]
        public async Task<ActionResult<EvaluationFormListResponse>> GetForms([FromQuery] EvaluationFormListQuery query, CancellationToken ct)
            => Ok(await _service.GetFormsAsync(GetActorUserId(), query, ct));

        /// <summary>POST /api/evaluation-forms — create from the builder (evaluations.forms.manage) → 201.</summary>
        [HttpPost]
        public async Task<ActionResult<EvaluationFormResponse>> CreateForm([FromBody] UpsertEvaluationFormRequest request, CancellationToken ct)
        {
            var response = await _service.CreateFormAsync(GetActorUserId(), request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        /// <summary>GET /api/evaluation-forms/{id} — form detail + questionList (evaluations.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<EvaluationFormResponse>> GetForm(int id, CancellationToken ct)
            => Ok(await _service.GetFormAsync(GetActorUserId(), id, ct));

        /// <summary>PUT /api/evaluation-forms/{id} — Save Form (evaluations.forms.manage).</summary>
        [HttpPut("{id:int}")]
        public async Task<ActionResult<EvaluationFormResponse>> UpdateForm(int id, [FromBody] UpsertEvaluationFormRequest request, CancellationToken ct)
            => Ok(await _service.UpdateFormAsync(GetActorUserId(), id, request, ct));

        /// <summary>DELETE /api/evaluation-forms/{id} — no submissions → 204 (evaluations.forms.manage).</summary>
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteForm(int id, CancellationToken ct)
        {
            await _service.DeleteFormAsync(GetActorUserId(), id, ct);
            return NoContent();
        }

        /// <summary>POST /api/evaluation-forms/{id}/dispatch — route to eligible evaluators (evaluations.manage).</summary>
        [HttpPost("{id:int}/dispatch")]
        public async Task<ActionResult<DispatchResponse>> Dispatch(int id, CancellationToken ct)
            => Ok(await _service.DispatchAsync(GetActorUserId(), id, ct));

        /// <summary>POST /api/evaluation-forms/{id}/responses — submit an evaluation → 201.</summary>
        [HttpPost("{id:int}/responses")]
        public async Task<ActionResult<SubmitEvaluationResponse>> SubmitResponse(int id, [FromBody] SubmitEvaluationRequest request, CancellationToken ct)
        {
            var response = await _service.SubmitResponseAsync(GetActorUserId(), id, request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        /// <summary>POST /api/evaluation-forms/{id}/launch-cycle — seed In Progress rows → 201.</summary>
        [HttpPost("{id:int}/launch-cycle")]
        public async Task<ActionResult<LaunchCycleResponse>> LaunchCycle(int id, [FromBody] LaunchCycleRequest request, CancellationToken ct)
        {
            var response = await _service.LaunchCycleAsync(GetActorUserId(), id, request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        /// <summary>GET /api/evaluation-forms/{id}/responses — history filtered to one form (evaluations.view).</summary>
        [HttpGet("{id:int}/responses")]
        public async Task<ActionResult<EvaluationResponseListResponse>> GetFormResponses(int id, [FromQuery] EvaluationResponseListQuery query, CancellationToken ct)
            => Ok(await _service.GetFormResponsesAsync(GetActorUserId(), id, query, ct));
    }
}
