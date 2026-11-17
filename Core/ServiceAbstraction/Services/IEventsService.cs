using Shared.DataTransferObject.Employee;
using Shared.DataTransferObject.Events;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// HR action queue (api-spec-from-ui.md §5.6). The queue is DERIVED from the
    /// underlying pending/expiring records on every read and materialized into
    /// Events rows (sync-on-read) so each card has a stable id, a persisted
    /// resolved state, and an audit/decision target. Every item carries the
    /// permission key that governs its visibility and its actions.
    /// </summary>
    public interface IEventsService
    {
        /// <summary>GET /api/events — paged, tab/type filtered, permission- and gym-filtered queue.</summary>
        Task<EventListResponse> GetEventsAsync(int? actorUserId, EventListQuery query, CancellationToken cancellationToken = default);

        /// <summary>GET /api/events/counts — per-tab open/high/resolved + escalations.open for the tab badges.</summary>
        Task<EventCountsDataResponse> GetCountsAsync(int? actorUserId, string? gym, CancellationToken cancellationToken = default);

        /// <summary>PUT /api/events/{id}/resolve — audit "Event Resolved" (idempotent).</summary>
        Task<EventResolveDataResponse> ResolveAsync(int? actorUserId, int eventId, CancellationToken cancellationToken = default);

        /// <summary>PUT /api/events/{id}/reopen — back to the open queue (idempotent).</summary>
        Task<EventResolveDataResponse> ReopenAsync(int? actorUserId, int eventId, CancellationToken cancellationToken = default);

        /// <summary>POST /api/events/{id}/renewal-request — 201, notifies the employee (Document notification) + audit.</summary>
        Task<EventRenewalDataResponse> RequestRenewalAsync(int? actorUserId, int eventId, CancellationToken cancellationToken = default);

        /// <summary>PUT /api/events/{id}/decide — transfer ticket: approve executes the gym move, reject closes it.</summary>
        Task<EventDecideDataResponse> DecideTransferAsync(int? actorUserId, int eventId, EventDecideRequest request, CancellationToken cancellationToken = default);
    }
}
