using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Recruitment;

namespace Presentation.Controllers
{
    /// <summary>Interviews calendar (api-spec-from-ui.md §5.1.4): schedule, list, complete, remind.</summary>
    [Route("api/interviews")]
    [Authorize]
    public class InterviewsController(IRecruitmentService _service) : ApiControllerBase
    {
        /// <summary>GET /api/interviews — paged; filters month/date/status(=all|pending|completed|cancelled)/candidateId (recruitment.view).</summary>
        [HttpGet]
        public async Task<ActionResult<InterviewListResponse>> GetInterviews([FromQuery] InterviewListQuery query, CancellationToken ct)
            => Ok(await _service.GetInterviewsAsync(GetActorUserId(), query, ct));

        /// <summary>GET /api/interviews/{id} — one interview (recruitment.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<InterviewDataResponse>> GetInterview(int id, CancellationToken ct)
            => Ok(await _service.GetInterviewAsync(GetActorUserId(), id, ct));

        /// <summary>POST /api/interviews — schedule an interview for a candidate (recruitment.candidates.manage).</summary>
        [HttpPost]
        public async Task<ActionResult<InterviewDataResponse>> CreateInterview([FromBody] CreateInterviewRequest request, CancellationToken ct)
        {
            var response = await _service.CreateInterviewAsync(GetActorUserId(), request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        /// <summary>PUT /api/interviews/{id}/complete — mark done (recruitment.candidates.manage).</summary>
        [HttpPut("{id:int}/complete")]
        public async Task<ActionResult<InterviewDataResponse>> CompleteInterview(int id, CancellationToken ct)
            => Ok(await _service.CompleteInterviewAsync(GetActorUserId(), id, ct));

        /// <summary>POST /api/interviews/{id}/reminder — notify the interviewer (recruitment.candidates.manage).</summary>
        [HttpPost("{id:int}/reminder")]
        public async Task<ActionResult<ReminderResponse>> SendReminder(int id, CancellationToken ct)
            => Ok(await _service.SendInterviewReminderAsync(GetActorUserId(), id, ct));
    }
}
