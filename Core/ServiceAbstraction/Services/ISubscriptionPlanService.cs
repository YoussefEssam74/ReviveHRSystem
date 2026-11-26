using Shared.DataTransferObject.Subscription;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Subscription plan catalog. TopManagement manages plans; gym accounts can
    /// read the active catalog to request an upgrade or renewal.
    /// </summary>
    public interface ISubscriptionPlanService
    {
        Task<IReadOnlyList<SubscriptionPlanDto>> GetPlansAsync(
            int? actorUserId, int? gymId, CancellationToken cancellationToken = default);

        Task<SubscriptionPlanDto> CreatePlanAsync(
            int? actorUserId, SaveSubscriptionPlanRequest request, CancellationToken cancellationToken = default);

        Task<SubscriptionPlanDto> UpdatePlanAsync(
            int? actorUserId, int planId, SaveSubscriptionPlanRequest request, CancellationToken cancellationToken = default);

        Task ArchivePlanAsync(int? actorUserId, int planId, CancellationToken cancellationToken = default);
    }
}
