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

        /// <summary>
        /// Branch-raised deductions in the caller's management scope (team for a Team
        /// Leader, gym for a Branch Manager), newest first, in every HR decision
        /// state. The optional employee id narrows one employee's performance tab.
        /// </summary>
        Task<IReadOnlyList<DeductionCandidateDto>> GetDeductionsAsync(
            int actorUserId, int? employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>Warning notices in the caller's management scope, newest first (<see cref="GetDeductionsAsync"/> semantics).</summary>
        Task<IReadOnlyList<WarningNoticeDto>> GetWarningsAsync(
            int actorUserId, int? employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>Bonus proposals in the caller's management scope, newest first (<see cref="GetDeductionsAsync"/> semantics).</summary>
        Task<IReadOnlyList<BonusProposalDto>> GetBonusesAsync(
            int actorUserId, int? employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>Sends a free-form report to HR (any employee may report; lands in the HR queue).</summary>
        Task SendReportAsync(int actorUserId, int? activeGymId, CreateBranchReportDto request, CancellationToken cancellationToken = default);
    }
}
