using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Evaluation;

namespace Presentation.Controllers
{
    /// <summary>
    /// Hiring forms — the admin side of the form builder (api-spec-from-ui.md §5.3);
    /// the GET routes are dual-mode and also serve the public careers view (§5.2).
    /// </summary>
    [Route("api/hiring-forms")]
    [Authorize]
    public class HiringFormsController(IEvaluationService _service) : ApiControllerBase
    {
        /// <summary>GET /api/hiring-forms — Hiring-tab cards with applicants counts (evaluations.view); anonymous callers get the open-forms catalogue only (§5.2).</summary>
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<HiringFormListResponse>> GetHiringForms([FromQuery] HiringFormListQuery query, CancellationToken ct)
            => Ok(await _service.GetHiringFormsAsync(CurrentActorOrNull(), query, ct));

        /// <summary>GET /api/hiring-forms/{id} — one form with its questionList; anonymous visitors only ever see Open forms (§5.2).</summary>
        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<ActionResult<HiringFormResponse>> GetHiringForm(int id, CancellationToken ct)
            => Ok(await _service.GetHiringFormAsync(CurrentActorOrNull(), id, ct));

        /// <summary>The authenticated uid, or null for the public careers view (never throws anonymously).</summary>
        private int? CurrentActorOrNull()
            => User.Identity?.IsAuthenticated == true ? GetActorUserId() : null;

        /// <summary>POST /api/hiring-forms — create (evaluations.forms.manage) → 201.</summary>
        [HttpPost]
        public async Task<ActionResult<HiringFormResponse>> CreateHiringForm([FromBody] UpsertHiringFormRequest request, CancellationToken ct)
        {
            var response = await _service.CreateHiringFormAsync(GetActorUserId(), request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        /// <summary>PUT /api/hiring-forms/{id} — Save Form (evaluations.forms.manage).</summary>
        [HttpPut("{id:int}")]
        public async Task<ActionResult<HiringFormResponse>> UpdateHiringForm(int id, [FromBody] UpsertHiringFormRequest request, CancellationToken ct)
            => Ok(await _service.UpdateHiringFormAsync(GetActorUserId(), id, request, ct));

        /// <summary>DELETE /api/hiring-forms/{id} — no applications → 204 (evaluations.forms.manage).</summary>
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteHiringForm(int id, CancellationToken ct)
        {
            await _service.DeleteHiringFormAsync(GetActorUserId(), id, ct);
            return NoContent();
        }
    }
}
