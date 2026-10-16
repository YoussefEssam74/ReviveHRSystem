using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Separation;

namespace Presentation.Controllers
{
    /// <summary>
    /// Separations / exit lifecycle (api-spec-from-ui.md §5.6 T1–T6): the pipeline
    /// list + detail, the Branch-Manager termination request, the exit checklist,
    /// stage moves, the HR exit verdict, and finalize (which archives the employee).
    /// Read routes need employees.view; every mutation needs employees.offboard.
    /// </summary>
    [Route("api/separations")]
    [Authorize]
    public class SeparationsController(ISeparationsService _service) : ApiControllerBase
    {
        /// <summary>T1 — GET /api/separations: paged pipeline with gym/status/type filters (employees.view).</summary>
        [HttpGet]
        public async Task<ActionResult<SeparationListResponse>> GetSeparations([FromQuery] SeparationListQuery query, CancellationToken cancellationToken)
            => Ok(await _service.GetSeparationsAsync(GetActorUserId(), query, cancellationToken));

        /// <summary>T1 detail — GET /api/separations/{id}: checklist + verdict (employees.view, gym-gated).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<SeparationDataResponse>> GetSeparation(int id, CancellationToken cancellationToken)
            => Ok(await _service.GetSeparationAsync(GetActorUserId(), id, cancellationToken));

        /// <summary>T2 — POST /api/separations: Branch-Manager termination request (closed reason vocabulary).</summary>
        [HttpPost]
        public async Task<ActionResult<SeparationDataResponse>> RequestSeparation([FromBody] CreateSeparationRequest request, CancellationToken cancellationToken)
            => Ok(await _service.RequestSeparationAsync(GetActorUserId(), request, cancellationToken));

        /// <summary>T3 — PUT /api/separations/{id}/checklist: toggle one exit step ({ index, done }).</summary>
        [HttpPut("{id:int}/checklist")]
        public async Task<ActionResult<SeparationChecklistDataResponse>> UpdateChecklist(int id, [FromBody] SeparationChecklistRequest request, CancellationToken cancellationToken)
            => Ok(await _service.UpdateChecklistAsync(GetActorUserId(), id, request, cancellationToken));

        /// <summary>T4 — PUT /api/separations/{id}/stage: move along the five exit stages (Completed ticks the checklist).</summary>
        [HttpPut("{id:int}/stage")]
        public async Task<ActionResult<Shared.DataTransferObject.Employee.MessageResponse>> UpdateStage(int id, [FromBody] SeparationStageRequest request, CancellationToken cancellationToken)
            => Ok(await _service.UpdateStageAsync(GetActorUserId(), id, request, cancellationToken));

        /// <summary>T5 — PUT /api/separations/{id}/verdict: store the exit verdict (status → Under Review).</summary>
        [HttpPut("{id:int}/verdict")]
        public async Task<ActionResult<Shared.DataTransferObject.Employee.MessageResponse>> SaveVerdict(int id, [FromBody] SeparationVerdictRequest request, CancellationToken cancellationToken)
            => Ok(await _service.SaveVerdictAsync(GetActorUserId(), id, request, cancellationToken));

        /// <summary>T6 — POST /api/separations/{id}/finalize: complete checklist + verdict required; archives the employee.</summary>
        [HttpPost("{id:int}/finalize")]
        public async Task<ActionResult<Shared.DataTransferObject.Employee.MessageResponse>> Finalize(int id, CancellationToken cancellationToken)
            => Ok(await _service.FinalizeAsync(GetActorUserId(), id, cancellationToken));
    }
}
