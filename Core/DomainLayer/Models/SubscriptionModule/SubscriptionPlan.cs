namespace DomainLayer.Models.SubscriptionModule
{
    /// <summary>
    /// A sellable HR-service subscription plan. Gyms are billed at the plan's
    /// price/cycle unless Revive Admin sets a per-gym amount override.
    /// </summary>
    public class SubscriptionPlan : BaseEntity<int>
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }

        public decimal PricePerCycle { get; set; }
        public int BillingCycleMonths { get; set; } = 1;

        /// <summary>Plan-level grace window; null falls back to the platform default.</summary>
        public int? GracePeriodDays { get; set; }

        /// <summary>Plan-level reminder lead; null falls back to the platform default.</summary>
        public int? ReminderLeadDays { get; set; }

        /// <summary>Archived plans stay readable for history but cannot be newly assigned.</summary>
        public bool IsActive { get; set; } = true;

        public int SortOrder { get; set; }

        public virtual ICollection<GymSubscription> Subscriptions { get; set; } = new List<GymSubscription>();
    }
}
