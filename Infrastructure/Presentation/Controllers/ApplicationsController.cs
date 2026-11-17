using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Recruitment;

namespace Presentation.Controllers
{
    /// <summary>
    /// Applications (api-spec-from-ui.md §5.1.3 / §5.2): pipeline stage moves and the
    /// hire wizard, plus the public hiring-form submission and its applicant pane.
    /// </summary>
    [Route("api/applications")]
    [Authorize]
    public class ApplicationsController(IRecruitmentService _service) : ApiControllerBase
    {
        /// <summary>POST /api/applications — anonymous hiring-form submission → 201 { message } (§5.2, per-IP rate-limited).</summary>
        [AllowAnonymous]
        [EnableRateLimiting("public-forms")]
        [HttpPost]
        public async Task<ActionResult<SubmitFormApplicationResponse>> SubmitApplication([FromBody] SubmitFormApplicationRequest request, CancellationToken ct)
        {
            var response = await _service.SubmitFormApplicationAsync(request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        /// <summary>GET /api/applications — Hiring-tab applicant pane; filters formId/status/searchTerm (recruitment.candidates.manage).</summary>
        [HttpGet]
        public async Task<ActionResult<FormApplicationListResponse>> GetApplications([FromQuery] FormApplicationListQuery query, CancellationToken ct)
            => Ok(await _service.GetFormApplicationsAsync(GetActorUserId(), query, ct));

        /// <summary>GET /api/applications/{id} — applicant detail with answers and reject comment (recruitment.candidates.manage).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<FormApplicationDetailResponse>> GetApplication(int id, CancellationToken ct)
            => Ok(await _service.GetFormApplicationAsync(GetActorUserId(), id, ct));

        /// <summary>PUT /api/applications/{id}/reject — mark Rejected with an optional comment (recruitment.candidates.manage).</summary>
        [HttpPut("{id:int}/reject")]
        public async Task<ActionResult<RejectFormApplicationResponse>> RejectApplication(int id, [FromBody] RejectFormApplicationRequest request, CancellationToken ct)
            => Ok(await _service.RejectFormApplicationAsync(GetActorUserId(), id, request, ct));
        /// <summary>PUT /api/applications/{id}/stage — move any valid stage, forward or backward; entering Second Interview schedules the round (recruitment.candidates.manage).</summary>
        [HttpPut("{id:int}/stage")]
        public async Task<ActionResult<ApplicationStageResponse>> ChangeStage(int id, [FromBody] ChangeApplicationStageRequest request, CancellationToken ct)
            => Ok(await _service.ChangeApplicationStageAsync(GetActorUserId(), id, request, ct));

        /// <summary>POST /api/applications/{id}/hire — the Hired transition: creates the User + Employee, links the candidate, decrements the vacancy headcount, starts onboarding (recruitment.hire.approve).</summary>
        [HttpPost("{id:int}/hire")]
        public async Task<ActionResult<HireDataResponse>> HireCandidate(int id, [FromBody] HireApplicationRequest request, CancellationToken ct)
        {
            var response = await _service.HireCandidateAsync(GetActorUserId(), id, request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }
    }
}
