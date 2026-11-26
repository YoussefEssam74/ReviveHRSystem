using Shared.DataTransferObject.Subscription;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Subscription management and automated access control for gym HR services
    /// (Revive Admin only). Owns the billing cycle, reminders, grace handling,
    /// automatic suspension/reactivation and the manual admin controls.
    /// </summary>
    public interface ISubscriptionService
    {
        /// <summary>All gym subscriptions, platform settings, totals and unconfigured gyms (Revive Admin).</summary>
        Task<SubscriptionOverviewResponse> GetOverviewAsync(int? actorUserId, CancellationToken cancellationToken = default);

        /// <summary>One gym's subscription with its invoice and payment history (Revive Admin).</summary>
        Task<GymSubscriptionDetailResponse> GetGymSubscriptionAsync(int? actorUserId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>Creates or updates a gym's subscription terms (Revive Admin).</summary>
        Task<SubscriptionActionResponse> SaveGymSubscriptionAsync(
            int? actorUserId, int gymId, SaveGymSubscriptionRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// Records a confirmed payment, allocates it to the oldest unpaid invoices and
        /// automatically restores a gym suspended by the automation.
        /// </summary>
        Task<SubscriptionActionResponse> RecordPaymentAsync(
            int? actorUserId, int gymId, RecordSubscriptionPaymentRequest request, CancellationToken cancellationToken = default);

        /// <summary>Manually suspends a gym's HR system access (Revive Admin).</summary>
        Task<SubscriptionActionResponse> SuspendAsync(
            int? actorUserId, int gymId, SuspendSubscriptionRequest request, CancellationToken cancellationToken = default);

        /// <summary>Manually restores a gym's access for a bounded override window (Revive Admin).</summary>
        Task<SubscriptionActionResponse> ReactivateAsync(
            int? actorUserId, int gymId, ReactivateSubscriptionRequest request, CancellationToken cancellationToken = default);

        /// <summary>Updates the platform-wide cycle, grace, reminder and suspension defaults.</summary>
        Task<SubscriptionSettingsDto> UpdateSettingsAsync(
            int? actorUserId, UpdateSubscriptionSettingsRequest request, CancellationToken cancellationToken = default);

        /// <summary>Runs the billing sweep immediately and reports what changed (Revive Admin).</summary>
        Task<RunSubscriptionCycleResponse> RunCycleAsync(int? actorUserId, CancellationToken cancellationToken = default);

        /// <summary>
        /// The automated daily cycle: issues due invoices, sends reminders/overdue
        /// notices, suspends past-grace gyms and restores paid ones. Safe to run
        /// concurrently (unique per-period invoice index + advisory lock).
        /// </summary>
        Task ProcessBillingCycleAsync(CancellationToken cancellationToken = default);

        /// <summary>True when the gym's subscription currently permits system access.</summary>
        Task<bool> IsGymAccessAllowedAsync(int gymId, CancellationToken cancellationToken = default);

        /// <summary>Of the supplied gyms, the ids whose subscription currently blocks access.</summary>
        Task<IReadOnlySet<int>> GetBlockedGymIdsAsync(IReadOnlyCollection<int> gymIds, CancellationToken cancellationToken = default);

        // ==================================================================
        // Gym-side self-service (Branch Manager / Super Admin of the gym)
        // ==================================================================

        /// <summary>Active gym's plan, status, invoices, payments, available plans and pending requests.</summary>
        Task<MySubscriptionResponse> GetMySubscriptionAsync(
            int? actorUserId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>Submits a renewal or plan-change request for Revive Admin review.</summary>
        Task<SubscriptionRequestDto> CreateMyRequestAsync(
            int? actorUserId, int gymId, CreateSubscriptionRequestRequest request, CancellationToken cancellationToken = default);

        // ==================================================================
        // Revive Admin request review
        // ==================================================================

        /// <summary>All gym requests, optionally filtered by status (Pending by default).</summary>
        Task<IReadOnlyList<SubscriptionRequestDto>> GetRequestsAsync(
            int? actorUserId, string? status, CancellationToken cancellationToken = default);

        /// <summary>Approves a request, applies the requested plan and ensures the renewal invoice exists.</summary>
        Task<SubscriptionActionResponse> ApproveRequestAsync(
            int? actorUserId, int requestId, ReviewSubscriptionRequestRequest request, CancellationToken cancellationToken = default);

        /// <summary>Rejects a pending request and notifies the gym.</summary>
        Task<SubscriptionActionResponse> RejectRequestAsync(
            int? actorUserId, int requestId, ReviewSubscriptionRequestRequest request, CancellationToken cancellationToken = default);
    }
}
