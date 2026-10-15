using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Recruitment;

namespace Presentation.Controllers
{
    /// <summary>
    /// Recruitment hub (api-spec-from-ui.md §5.1.3–§5.1.6): follow-ups, the waiting
    /// list, and the New Comers onboarding checklist.
    /// </summary>
    [Route("api/recruitment")]
    [Authorize]
    public class RecruitmentController(IRecruitmentService _service) : ApiControllerBase
    {
        /// <summary>GET /api/recruitment/follow-ups — candidates stalled &gt;5 days in a non-terminal stage (recruitment.view).</summary>
        [HttpGet("follow-ups")]
        public async Task<ActionResult<CandidateListResponse>> GetFollowUps([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
            => Ok(await _service.GetFollowUpsAsync(GetActorUserId(), page, pageSize, ct));

        /// <summary>GET /api/recruitment/waiting-list — parked candidates + matching open vacancies (recruitment.view).</summary>
        [HttpGet("waiting-list")]
        public async Task<ActionResult<WaitingListResponse>> GetWaitingList([FromQuery] WaitingListQuery query, CancellationToken ct)
            => Ok(await _service.GetWaitingListAsync(GetActorUserId(), query, ct));

        /// <summary>POST /api/recruitment/waiting-list/{id}/assign — 3-step hire wizard for a waiting candidate (recruitment.hire.approve).</summary>
        [HttpPost("waiting-list/{id:int}/assign")]
        public async Task<ActionResult<AssignWaitingDataResponse>> AssignWaitingCandidate(int id, [FromBody] AssignWaitingRequest request, CancellationToken ct)
        {
            var response = await _service.AssignWaitingCandidateAsync(GetActorUserId(), id, request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        /// <summary>DELETE /api/recruitment/waiting-list/{id} — remove from the waiting list (recruitment.candidates.manage).</summary>
        [HttpDelete("waiting-list/{id:int}")]
        public async Task<IActionResult> RemoveFromWaitingList(int id, CancellationToken ct)
        {
            await _service.RemoveFromWaitingListAsync(GetActorUserId(), id, ct);
            return NoContent();
        }

        /// <summary>GET /api/employees/new-comers — recent hires with onboarding checklists (recruitment.view).</summary>
        [HttpGet("/api/employees/new-comers")]
        public async Task<ActionResult<NewComerListResponse>> GetNewComers(CancellationToken ct)
            => Ok(await _service.GetNewComersAsync(GetActorUserId(), ct));

        /// <summary>PUT /api/employees/{id}/onboarding-checklist — single `{item, done}` toggle or batch `{checklist}` replace (recruitment.hire.approve).</summary>
        [HttpPut("/api/employees/{id:int}/onboarding-checklist")]
        public async Task<ActionResult<OnboardingChecklistResponse>> UpdateOnboardingChecklist(int id, [FromBody] OnboardingChecklistRequest request, CancellationToken ct)
            => Ok(await _service.UpdateOnboardingChecklistAsync(GetActorUserId(), id, request, ct));
    }
}
