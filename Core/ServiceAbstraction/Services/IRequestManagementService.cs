using Shared;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;

namespace ServiceAbstraction.Services
{
    /// <summary>Management-side request workflow: scoped inbox, stage-1 decision, edit.</summary>
    public interface IRequestManagementService
    {
        /// <summary>Inbox of requests of in-scope employees (team for TLs, gym for BMs).</summary>
        Task<PaginationResult<EmployeeRequestDto>> GetInboxAsync(
            int actorUserId, int? activeGymId, RequestQueryParams query, CancellationToken cancellationToken = default);

        /// <summary>Stage-1 (BranchManager) decision: approve to HR review or reject.</summary>
        Task DecideAsync(
            int actorUserId, int requestId, int? activeGymId, RequestDecisionDto decision, CancellationToken cancellationToken = default);

        /// <summary>Edits a pending request on behalf of an in-scope employee.</summary>
        Task EditAsync(
            int actorUserId, int requestId, int? activeGymId, UpdateRequestDto update, CancellationToken cancellationToken = default);

        /// <summary>Posts a comment on an in-scope request (collaboration trail).</summary>
        Task<RequestCommentDto> AddCommentAsync(
            int actorUserId, int requestId, int? activeGymId, CreateRequestCommentDto request, CancellationToken cancellationToken = default);
    }
}

/// <summary>
/// Stage-1 decision body. <see cref="Stage"/> carries the approval stage the decision
/// belongs to (BranchManager = stage 1, HR = the portal's final decision); it defaults
/// to BranchManager so existing clients keep working while the contract grows.
/// </summary>
public sealed class RequestDecisionDto
{
    /// <summary>BranchManager (default, stage 1) or HR (stage 2, HR portal).</summary>
    public string? Stage { get; init; }

    public string Decision { get; init; } = string.Empty;
    public string? Comment { get; init; }
}

/// <summary>Manager edit body for a pending request.</summary>
public sealed class UpdateRequestDto
{
    public string? Type { get; init; }
    public DateOnly? RequestDate { get; init; }
    public DateOnly? EndDate { get; init; }
    public string? Reason { get; init; }
}
