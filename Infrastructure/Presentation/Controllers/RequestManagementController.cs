using Microsoft.AspNetCore.Mvc;
using Presentation.Authorization;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;
using DomainLayer.Models.UserModule.Enums;

namespace Presentation.Controllers
{
    /// <summary>
    /// Management request inbox and the stage-1 (BranchManager) decision
    /// (mock §17 Team / Requests Management). Gated by the `requests` feature;
    /// the service resolves team scope for Team Leaders and gym scope for BMs.
    /// HR's final decision lives in the HR portal.
    /// </summary>
    [Route("api/requests")]
    public class RequestManagementController(IRequestManagementService requestManagementService) : ApiControllerBase
    {
        /// <summary>Inbox of in-scope requests, filterable by status.</summary>
        [HttpGet]
        [HasFeatureAccess(Features.Requests, AccessLevel.View)]
        public async Task<ActionResult<IReadOnlyList<EmployeeRequestDto>>> GetInbox(
            [FromQuery] string? status, CancellationToken cancellationToken)
        {
            var requests = await requestManagementService.GetInboxAsync(
                GetActorUserId(), GetGymIdFromToken(), status, cancellationToken);
            return Ok(requests);
        }

        /// <summary>Stage-1 decision: Approved moves the request to HR review, Rejected closes it.</summary>
        [HttpPost("{id}/decide")]
        [HasFeatureAccess(Features.Requests, AccessLevel.Edit)]
        public async Task<IActionResult> Decide(int id, RequestDecisionDto decision, CancellationToken cancellationToken)
        {
            await requestManagementService.DecideAsync(
                GetActorUserId(), id, GetGymIdFromToken(), decision, cancellationToken);
            return NoContent();
        }

        /// <summary>Edits a pending request of an in-scope employee.</summary>
        [HttpPut("{id}")]
        [HasFeatureAccess(Features.Requests, AccessLevel.Edit)]
        public async Task<IActionResult> Edit(int id, UpdateRequestDto update, CancellationToken cancellationToken)
        {
            await requestManagementService.EditAsync(
                GetActorUserId(), id, GetGymIdFromToken(), update, cancellationToken);
            return NoContent();
        }
    }
}
