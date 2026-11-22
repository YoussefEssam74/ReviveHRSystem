using DomainLayer.Models.BillingModule;

namespace DomainLayer.Models.PlatformModule
{
    /// <summary>
    /// Binds a <see cref="FeatureFlag"/> to one plan or one company. Exactly one of
    /// <see cref="PlanId"/> / <see cref="CompanyId"/> is set, matching the flag's scope.
    /// </summary>
    public class FeatureFlagTarget : BaseEntity<int>
    {
        public int FeatureFlagId { get; set; }
        public virtual FeatureFlag FeatureFlag { get; set; } = null!;

        public int? PlanId { get; set; }
        public virtual SubscriptionPlan? Plan { get; set; }

        public int? CompanyId { get; set; }
        public virtual Company? Company { get; set; }
    }
}
