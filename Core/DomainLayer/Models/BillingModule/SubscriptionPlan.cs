using DomainLayer.Models.BillingModule.Enums;

namespace DomainLayer.Models.BillingModule
{
    /// <summary>
    /// A commercial subscription tier the platform sells (Starter / Growth / Enterprise).
    /// Billing cadence is free-form — every N months or every N years — rather than a fixed
    /// monthly/annual list. A null seat or branch limit means unlimited.
    /// </summary>
    public class SubscriptionPlan : BaseEntity<int>
    {
        public string Name { get; set; } = string.Empty;

        /// <summary>URL-safe identifier; unique. Kept alongside Name so invoices can reference a stable key.</summary>
        public string Slug { get; set; } = string.Empty;

        /// <summary>One-line positioning shown on the plan card.</summary>
        public string? Tagline { get; set; }

        public decimal Price { get; set; }
        public string Currency { get; set; } = "EGP";

        /// <summary>Bills every <see cref="CycleCount"/> × <see cref="CycleUnit"/>. Count is at least 1.</summary>
        public int CycleCount { get; set; } = 1;
        public PlanCycleUnit CycleUnit { get; set; } = PlanCycleUnit.Months;

        public TrialMode TrialMode { get; set; } = TrialMode.None;

        /// <summary>Free-trial length when <see cref="TrialMode"/> is Days; otherwise 0.</summary>
        public int TrialDays { get; set; }

        /// <summary>Maximum active users. Null = unlimited.</summary>
        public int? SeatLimit { get; set; }

        /// <summary>Maximum branches. Null = unlimited.</summary>
        public int? BranchLimit { get; set; }

        /// <summary>At most one plan carries this flag — it renders the "Popular" badge.</summary>
        public bool IsHighlighted { get; set; }

        /// <summary>Archived plans stay readable for historical invoices but cannot be assigned.</summary>
        public bool IsArchived { get; set; }

        public int SortOrder { get; set; }

        // Navigations
        public virtual ICollection<PlanFeature> Features { get; set; } = new List<PlanFeature>();
        public virtual ICollection<PlanAddOn> AddOns { get; set; } = new List<PlanAddOn>();
        public virtual ICollection<CompanySubscription> Subscriptions { get; set; } = new List<CompanySubscription>();
    }
}
