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

        /// <summary>
        /// The branch's decision on one of its deductions before HR applies it to
        /// payroll: approve (BranchApproved), reject (final) or re-price the amount.
        /// Requires the caller's management scope over the deduction's employee.
        /// </summary>
        Task<DeductionCandidateDto> BranchReviewDeductionAsync(
            int actorUserId, int candidateId, BranchDeductionReviewRequest request, int? activeGymId, CancellationToken cancellationToken = default);

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

        /// <summary>
        /// Both rates of one deduction's month plus the money a size costs — what the
        /// branch manager sees while choosing hours or days.
        /// </summary>
        Task<DeductionPricingDto> GetDeductionPricingAsync(
            int actorUserId, int candidateId, string? unit, decimal? value, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Prices a deduction that does not exist yet (the follow-up form's live preview)
        /// with exactly the rates the saved row will use.
        /// </summary>
        Task<DeductionPricingDto> PreviewDeductionAsync(
            int actorUserId, int employeeId, DateOnly? date, string? unit, decimal? value, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>
        /// The deductions awaiting the HR sign-off (branch-sized and approved), scoped to
        /// the caller's gyms — the HR Requests page's Deductions tab.
        /// </summary>
        Task<IReadOnlyList<DeductionCandidateDto>> GetDeductionReviewQueueAsync(
            int actorUserId, string? status, CancellationToken cancellationToken = default);

        /// <summary>
        /// The HR sign-off on a branch-sized deduction: approve (payroll applies it) or
        /// waive it, optionally re-sized through the same hourly/daily rates.
        /// </summary>
        Task<DeductionCandidateDto> ReviewDeductionCandidateAsync(
            int actorUserId, int candidateId, BranchDeductionReviewRequest request, CancellationToken cancellationToken = default);

        /// <summary>Warning notices in the caller's management scope, newest first (<see cref="GetDeductionsAsync"/> semantics).</summary>
        Task<IReadOnlyList<WarningNoticeDto>> GetWarningsAsync(
            int actorUserId, int? employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>Bonus proposals in the caller's management scope, newest first (<see cref="GetDeductionsAsync"/> semantics).</summary>
        Task<IReadOnlyList<BonusProposalDto>> GetBonusesAsync(
            int actorUserId, int? employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>Sends a free-form report to HR (any employee may report; lands in the HR queue).</summary>
        Task SendReportAsync(int actorUserId, int? activeGymId, CreateBranchReportDto request, CancellationToken cancellationToken = default);

        // ------------------------------------------------------------------
        // HR-side review (requests.approve / requests.view)
        // ------------------------------------------------------------------

        /// <summary>Paged warning-notice review queue (requests.view).</summary>
        Task<ProposalListResponse<WarningNoticeDto>> GetWarningsAsync(
            int? actorUserId, ProposalListQuery query, CancellationToken cancellationToken = default);

        /// <summary>Files or declines a warning notice (requests.approve).</summary>
        Task<ReviewProposalResponse<WarningNoticeDto>> ReviewWarningAsync(
            int? actorUserId, int noticeId, ReviewProposalRequest request, CancellationToken cancellationToken = default);

        /// <summary>Paged bonus-proposal review queue (requests.view).</summary>
        Task<ProposalListResponse<BonusProposalDto>> GetBonusesAsync(
            int? actorUserId, ProposalListQuery query, CancellationToken cancellationToken = default);

        /// <summary>Approves or declines a bonus proposal (requests.approve).</summary>
        Task<ReviewProposalResponse<BonusProposalDto>> ReviewBonusAsync(
            int? actorUserId, int proposalId, ReviewProposalRequest request, CancellationToken cancellationToken = default);
    }
}
