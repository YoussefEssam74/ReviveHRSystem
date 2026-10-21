using Shared.DataTransferObject.Employee;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Escalated employee action requests (api-spec-from-ui.md §9.4 / D6–D8): the
    /// Events page "Escalated" tab. Each row is visible only to holders of its
    /// ACTION_TYPES meta permission; approving executes the effect server-side
    /// (gym transfer / compensation / role / offboard / import audit) and rejects
    /// close it with a required comment.
    /// </summary>
    public interface IActionRequestService
    {
        /// <summary>GET /api/action-requests — permission-filtered per action type, gym-scoped (status=Pending feeds the tab).</summary>
        Task<ActionRequestListResponse> GetActionRequestsAsync(int? actorUserId, ActionRequestListQuery query, CancellationToken cancellationToken = default);

        /// <summary>PUT /api/action-requests/{id}/approve — executes the proposed change + audit.</summary>
        Task<ActionRequestDecisionResponse> ApproveAsync(int? actorUserId, int requestId, CancellationToken cancellationToken = default);

        /// <summary>PUT /api/action-requests/{id}/reject — body { comment } (required) + audit "{Label} Request Rejected".</summary>
        Task<ActionRequestDecisionResponse> RejectAsync(int? actorUserId, int requestId, ActionRequestRejectRequest request, CancellationToken cancellationToken = default);
    }
}
