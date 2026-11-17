using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Events;

namespace Presentation.Controllers
{
    /// <summary>
    /// HR action queue (api-spec-from-ui.md §5.6): the Events page. Every read
    /// re-derives the queue from the pending/expiring sources and materializes it
    /// into Events rows, so cards have stable ids and a persisted resolved overlay.
    /// Each card's actions are gated by the per-type permission key it carries.
    /// </summary>
    [Route("api/events")]
    [Authorize]
    public class EventsController(IEventsService _service) : ApiControllerBase
    {
        /// <summary>GET /api/events — paged, tab/type/urgency/resolved filtered queue (events.view).</summary>
        [HttpGet]
        public async Task<ActionResult<EventListResponse>> GetEvents([FromQuery] EventListQuery query, CancellationToken cancellationToken)
            => Ok(await _service.GetEventsAsync(GetActorUserId(), query, cancellationToken));

        /// <summary>GET /api/events/counts — per-tab open/high/resolved + escalations.open badges.</summary>
        [HttpGet("counts")]
        public async Task<ActionResult<EventCountsDataResponse>> GetCounts([FromQuery] string? gym, CancellationToken cancellationToken)
            => Ok(await _service.GetCountsAsync(GetActorUserId(), gym, cancellationToken));

        /// <summary>PUT /api/events/{id}/resolve — audit "Event Resolved" (idempotent).</summary>
        [HttpPut("{id:int}/resolve")]
        public async Task<ActionResult<EventResolveDataResponse>> Resolve(int id, CancellationToken cancellationToken)
            => Ok(await _service.ResolveAsync(GetActorUserId(), id, cancellationToken));

        /// <summary>PUT /api/events/{id}/reopen — back onto the open queue (idempotent).</summary>
        [HttpPut("{id:int}/reopen")]
        public async Task<ActionResult<EventResolveDataResponse>> Reopen(int id, CancellationToken cancellationToken)
            => Ok(await _service.ReopenAsync(GetActorUserId(), id, cancellationToken));

        /// <summary>POST /api/events/{id}/renewal-request — 201, notifies the employee + audit "Document Renewal Requested".</summary>
        [HttpPost("{id:int}/renewal-request")]
        public async Task<ActionResult<EventRenewalDataResponse>> RequestRenewal(int id, CancellationToken cancellationToken)
            => StatusCode(StatusCodes.Status201Created, await _service.RequestRenewalAsync(GetActorUserId(), id, cancellationToken));

        /// <summary>PUT /api/events/{id}/decide — transfer ticket: approve executes the gym move, reject closes it.</summary>
        [HttpPut("{id:int}/decide")]
        public async Task<ActionResult<EventDecideDataResponse>> Decide(int id, [FromBody] EventDecideRequest request, CancellationToken cancellationToken)
            => Ok(await _service.DecideTransferAsync(GetActorUserId(), id, request, cancellationToken));
    }
}
