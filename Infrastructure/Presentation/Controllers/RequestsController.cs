using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Employee;
using Shared.DataTransferObject.Request;

namespace Presentation.Controllers
{
    /// <summary>
    /// HR requests endpoints (S3, Section 4 R1–R7): the paged inbox with the UI's
    /// filters, detail, on-behalf creation, the HR decision stage, undo, bulk
    /// approve, and archive/restore. Every action is JWT-authenticated; the
    /// requests.view / requests.approve guards run inside the service (ADR-003).
    /// Shapes follow the UI spec: paged envelope for lists, { data } for detail and
    /// create (201), { message, item } for decisions, { message } for archive.
    /// </summary>
    [Route("api/requests")]
    [Authorize]
    public class RequestsController(IRequestService _service) : ApiControllerBase
    {
        /// <summary>GET /api/requests â€” paged inbox with status/type/gym/date/quick filters (R1, requests.view).</summary>
        [HttpGet]
        public async Task<ActionResult<RequestListResponse>> GetRequests([FromQuery] RequestListQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetRequestsAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/requests/{id} â€” one request with its decision trail (R2, requests.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<RequestDetailResponse>> GetRequest(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetRequestAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/requests â€” HR submits a request on an employee's behalf, by name (R7) â†’ 201 { data }.</summary>
        [HttpPost]
        public async Task<ActionResult<CreateRequestResponse>> CreateRequest([FromBody] CreateRequestRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateRequestAsync(GetActorUserId(), request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>POST /api/requests/{id}/decide â€” approve/reject with payment handling (R3, A6, requests.approve).</summary>
        [HttpPost("{id:int}/decide")]
        public async Task<ActionResult<RequestDecisionResponse>> DecideRequest(int id, [FromBody] DecideRequestRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.DecideRequestAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/requests/{id}/undo-decision â€” reverts an HR decision while the date is ahead (R4, requests.approve).</summary>
        [HttpPost("{id:int}/undo-decision")]
        public async Task<ActionResult<RequestDecisionResponse>> UndoDecision(int id, [FromBody] UndoDecisionRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.UndoDecisionAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/requests/bulk-decide â€” approves pending requests in bulk (R5, requests.approve).</summary>
        [HttpPost("bulk-decide")]
        public async Task<ActionResult<BulkDecideResponse>> BulkDecide([FromBody] BulkDecideRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.BulkDecideAsync(GetActorUserId(), request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/requests/{id}/archive â€” moves the request to the Archived tab (R6, requests.view).</summary>
        [HttpPost("{id:int}/archive")]
        public async Task<ActionResult<MessageResponse>> ArchiveRequest(int id, CancellationToken cancellationToken)
        {
            var result = await _service.ArchiveRequestAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/requests/{id}/restore â€” restores an archived request to its derived status (R6, requests.view).</summary>
        [HttpPost("{id:int}/restore")]
        public async Task<ActionResult<MessageResponse>> RestoreRequest(int id, CancellationToken cancellationToken)
        {
            var result = await _service.RestoreRequestAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }
    }
}
