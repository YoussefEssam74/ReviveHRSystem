using Microsoft.AspNetCore.Mvc;
using Presentation.Authorization;
using ServiceAbstraction.Services;
using Shared;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;
using DomainLayer.Models.UserModule.Enums;

namespace Presentation.Controllers
{
    /// <summary>
    /// Branch-manager request actions (mock §17 Team / Requests Management) that the
    /// HR portal does not own: editing a pending request and posting a comment.
    /// The directory inbox and both decision endpoints live in the HR portal's
    /// RequestsController.
    /// </summary>
    [Route("api/requests")]
    public class RequestManagementController(IRequestManagementService requestManagementService) : ApiControllerBase
    {
        /// <summary>Edits a pending request of an in-scope employee.</summary>
        [HttpPut("{id}")]
        [HasFeatureAccess(Features.Requests, AccessLevel.Edit)]
        public async Task<IActionResult> Edit(int id, UpdateRequestDto update, CancellationToken cancellationToken)
        {
            await requestManagementService.EditAsync(
                GetActorUserId(), id, GetGymIdFromToken(), update, cancellationToken);
            return NoContent();
        }

        /// <summary>Posts a comment on an in-scope request.</summary>
        [HttpPost("{id}/comments")]
        [HasFeatureAccess(Features.Requests, AccessLevel.View)]
        public async Task<ActionResult<RequestCommentDto>> Comment(
            int id, CreateRequestCommentDto request, CancellationToken cancellationToken)
        {
            var comment = await requestManagementService.AddCommentAsync(
                GetActorUserId(), id, GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/requests/{id}/comments/{comment.Id}", comment);
        }
    }
}
