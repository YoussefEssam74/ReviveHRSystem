namespace DomainLayer.Models.BillingModule
{
    /// <summary>
    /// One marketing bullet on a plan ("Multi-branch scoping &amp; transfers").
    /// Free text by design: plan features are a sales catalogue, deliberately separate from
    /// the permission table, which gates what the app actually allows.
    /// </summary>
    public class PlanFeature : BaseEntity<int>
    {
        public int PlanId { get; set; }
        public virtual SubscriptionPlan Plan { get; set; } = null!;

        public string Label { get; set; } = string.Empty;
        public int SortOrder { get; set; }
    }
}
