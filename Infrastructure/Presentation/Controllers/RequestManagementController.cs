using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;

namespace Presentation.Controllers
{
    /// <summary>
    /// Management-side request desk (mock §17 Team/Requests Management): the
    /// scoped inbox (team for Team Leaders, gym for Branch Managers), stage-1
    /// decisions that move a pending request to HR review, and editing/commenting.
    /// The HR decision stage lives in the HR portal's RequestsController. Scope is
    /// enforced inside the service — no permission key involved.
    /// </summary>
    [Route("api/requests")]
    public class RequestManagementController(IRequestManagementService requestManagementService) : ApiControllerBase
    {
        /// <summary>GET /api/requests/inbox — in-scope requests, newest first (stage-1 desk).</summary>
        [HttpGet("inbox")]
        public async Task<ActionResult<PaginationResult<EmployeeRequestDto>>> Inbox(
            [FromQuery] RequestQueryParams query, CancellationToken cancellationToken)
        {
            var inbox = await requestManagementService.GetInboxAsync(
                GetActorUserId(), GetGymIdFromToken(), query, cancellationToken);
            return Ok(inbox);
        }

        /// <summary>POST /api/requests/{id}/decisions — stage-1 approve/reject (moves to HR review).</summary>
        [HttpPost("{id}/decisions")]
        public async Task<IActionResult> Decide(int id, RequestDecisionDto decision, CancellationToken cancellationToken)
        {
            await requestManagementService.DecideAsync(
                GetActorUserId(), id, GetGymIdFromToken(), decision, cancellationToken);
            return NoContent();
        }

        /// <summary>Edits a pending request of an in-scope employee.</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Edit(int id, UpdateRequestDto update, CancellationToken cancellationToken)
        {
            await requestManagementService.EditAsync(
                GetActorUserId(), id, GetGymIdFromToken(), update, cancellationToken);
            return NoContent();
        }

        /// <summary>Posts a comment on an in-scope request.</summary>
        [HttpPost("{id}/comments")]
        public async Task<ActionResult<RequestCommentDto>> Comment(
            int id, CreateRequestCommentDto request, CancellationToken cancellationToken)
        {
            var comment = await requestManagementService.AddCommentAsync(
                GetActorUserId(), id, GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/requests/{id}/comments/{comment.Id}", comment);
        }
    }
}
