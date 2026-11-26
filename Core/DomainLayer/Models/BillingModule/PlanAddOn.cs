namespace DomainLayer.Models.BillingModule
{
    /// <summary>
    /// A priced overage line on a plan — "extra 5 employees for EGP 100" — charged once the
    /// plan's own allowance is exceeded. A plan with no add-ons is a fixed plan.
    /// </summary>
    public class PlanAddOn : BaseEntity<int>
    {
        public int PlanId { get; set; }
        public virtual SubscriptionPlan Plan { get; set; } = null!;

        public string Name { get; set; } = string.Empty;

        /// <summary>How many units the price covers (5 employees, 1 branch, …).</summary>
        public int Quantity { get; set; } = 1;

        public decimal Price { get; set; }
        public int SortOrder { get; set; }
    }
}
