using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Employee;

namespace Presentation.Controllers
{
    /// <summary>
    /// Escalated employee action requests (api-spec-from-ui.md §9.4): the Events
    /// page's Escalated tab. Reading needs events.view OR any ACTION_TYPES meta
    /// permission; approve/reject need the row's own meta key and execute (or
    /// refuse) the proposed effect server-side.
    /// </summary>
    [Route("api/action-requests")]
    [Authorize]
    public class ActionRequestsController(IActionRequestService _service) : ApiControllerBase
    {
        /// <summary>GET /api/action-requests — permission-filtered per action type, gym-scoped (status=Pending feeds the tab).</summary>
        [HttpGet]
        public async Task<ActionResult<ActionRequestListResponse>> GetActionRequests([FromQuery] ActionRequestListQuery query, CancellationToken cancellationToken)
            => Ok(await _service.GetActionRequestsAsync(GetActorUserId(), query, cancellationToken));

        /// <summary>PUT /api/action-requests/{id}/approve — executes the effect + audit.</summary>
        [HttpPut("{id:int}/approve")]
        public async Task<ActionResult<ActionRequestDecisionResponse>> Approve(int id, CancellationToken cancellationToken)
            => Ok(await _service.ApproveAsync(GetActorUserId(), id, cancellationToken));

        /// <summary>PUT /api/action-requests/{id}/reject — body { comment } (required) + audit "{Label} Request Rejected".</summary>
        [HttpPut("{id:int}/reject")]
        public async Task<ActionResult<ActionRequestDecisionResponse>> Reject(int id, [FromBody] ActionRequestRejectRequest request, CancellationToken cancellationToken)
            => Ok(await _service.RejectAsync(GetActorUserId(), id, request, cancellationToken));
    }
}
