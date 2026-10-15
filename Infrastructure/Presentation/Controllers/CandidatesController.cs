using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Recruitment;

namespace Presentation.Controllers
{
    /// <summary>Candidate pipeline (api-spec-from-ui.md §5.1.3): kanban/table list, detail, block/restore.</summary>
    [Route("api/candidates")]
    [Authorize]
    public class CandidatesController(IRecruitmentService _service) : ApiControllerBase
    {
        /// <summary>GET /api/candidates — paged pipeline; filters stage/position/view(=active|rejected)/blocked/searchTerm (recruitment.view).</summary>
        [HttpGet]
        public async Task<ActionResult<CandidateListResponse>> GetCandidates([FromQuery] CandidateListQuery query, CancellationToken ct)
            => Ok(await _service.GetCandidatesAsync(GetActorUserId(), query, ct));

        /// <summary>GET /api/candidates/{id} — full candidate detail (application form, screening, interviews, decision) (recruitment.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<CandidateDataResponse>> GetCandidate(int id, CancellationToken ct)
            => Ok(await _service.GetCandidateAsync(GetActorUserId(), id, ct));

        /// <summary>PUT /api/candidates/{id}/block — block (or restore) a candidate, gating re-applications (recruitment.candidates.manage).</summary>
        [HttpPut("{id:int}/block")]
        public async Task<ActionResult<CandidateBlockResponse>> SetCandidateBlock(int id, [FromBody] BlockCandidateRequest request, CancellationToken ct)
            => Ok(await _service.SetCandidateBlockAsync(GetActorUserId(), id, request, ct));

        /// <summary>POST /api/candidates — "Add to Pipeline": converts a hiring-form applicant into a pipeline candidate → 201 (recruitment.candidates.manage).</summary>
        [HttpPost]
        public async Task<ActionResult<ConvertToCandidateResponse>> ConvertApplication([FromBody] ConvertToCandidateRequest request, CancellationToken ct)
        {
            var response = await _service.ConvertApplicationToCandidateAsync(GetActorUserId(), request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }
    }
}
