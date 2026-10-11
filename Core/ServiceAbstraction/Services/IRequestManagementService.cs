using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>Management-side request workflow: scoped inbox, stage-1 decision, edit.</summary>
    public interface IRequestManagementService
    {
        /// <summary>Inbox of requests of in-scope employees (team for TLs, gym for BMs).</summary>
        Task<IReadOnlyList<EmployeeRequestDto>> GetInboxAsync(
            int actorUserId, int? activeGymId, string? status, CancellationToken cancellationToken = default);

        /// <summary>Stage-1 (BranchManager) decision: approve to HR review or reject.</summary>
        Task DecideAsync(
            int actorUserId, int requestId, int? activeGymId, RequestDecisionDto decision, CancellationToken cancellationToken = default);

        /// <summary>Edits a pending request on behalf of an in-scope employee.</summary>
        Task EditAsync(
            int actorUserId, int requestId, int? activeGymId, UpdateRequestDto update, CancellationToken cancellationToken = default);
    }
}

/// <summary>Stage-1 decision body: { decision: "Approved" | "Rejected", comment? }.</summary>
public sealed class RequestDecisionDto
{
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
