using DomainLayer.Models.BillingModule.Enums;

namespace DomainLayer.Models.BillingModule
{
    /// <summary>
    /// A company's current commercial agreement. Exactly one non-cancelled row may exist per
    /// company (enforced by a filtered unique index). Changing plan does not rewrite history:
    /// the previous row is cancelled and a new one is opened.
    ///
    /// The override columns snapshot the terms that applied when the row was opened, so a
    /// price change to the plan never reprices a company mid-period. They are cleared at
    /// renewal, at which point the plan's live values take over.
    /// </summary>
    public class CompanySubscription : BaseEntity<int>
    {
        public int CompanyId { get; set; }
        public virtual PlatformModule.Company Company { get; set; } = null!;

        public int PlanId { get; set; }
        public virtual SubscriptionPlan Plan { get; set; } = null!;

        public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Trial;

        public DateTime StartedOn { get; set; }
        public DateTime CurrentPeriodStart { get; set; }
        public DateTime CurrentPeriodEnd { get; set; }
        public DateTime? TrialEndsOn { get; set; }
        public DateTime? RenewsOn { get; set; }

        public DateTime? CancelledOn { get; set; }
        public string? CancelReason { get; set; }

        public decimal? PriceOverride { get; set; }
        public int? SeatLimitOverride { get; set; }
        public int? BranchLimitOverride { get; set; }
    }
}
