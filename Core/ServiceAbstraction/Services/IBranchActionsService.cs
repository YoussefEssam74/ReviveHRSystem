using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Branch Actions queue (mock §20): the manager raises deductions, warning notices
    /// and bonus proposals for HR, and can send a free-form report. Every item lands in
    /// the HR queue as Pending; HR's decision is final (HR portal surface).
    /// </summary>
    public interface IBranchActionsService
    {
        Task<DeductionCandidateDto> IssueDeductionAsync(
            int actorUserId, int? activeGymId, CreateDeductionCandidateDto request, CancellationToken cancellationToken = default);

        Task<WarningNoticeDto> IssueWarningAsync(
            int actorUserId, int? activeGymId, CreateWarningNoticeDto request, CancellationToken cancellationToken = default);

        Task<BonusProposalDto> ProposeBonusAsync(
            int actorUserId, int? activeGymId, CreateBonusProposalDto request, CancellationToken cancellationToken = default);

        /// <summary>Everything this caller raised in the active gym that is still pending with HR.</summary>
        Task<IReadOnlyList<BranchQueueItemDto>> GetPendingForHrAsync(
            int actorUserId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>Sends a free-form report to HR (any employee may report; lands in the HR queue).</summary>
        Task SendReportAsync(int actorUserId, int? activeGymId, CreateBranchReportDto request, CancellationToken cancellationToken = default);
    }
}
