using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.SubscriptionModule.Enums;

namespace DomainLayer.Models.SubscriptionModule
{
    /// <summary>
    /// The monthly HR-service subscription of one gym. The billing anchor defines
    /// the cycle (every <see cref="BillingCycleMonths"/> months); each cycle raises
    /// one <see cref="SubscriptionInvoice"/> due on the cycle start date. An unpaid
    /// invoice moves the subscription through <see cref="SubscriptionStatus.GracePeriod"/>
    /// and then, when the grace window elapses, to <see cref="SubscriptionStatus.Suspended"/>.
    /// </summary>
    public class GymSubscription : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        /// <summary>Assigned catalog plan; null = a purely custom agreement.</summary>
        public int? PlanId { get; set; }
        public virtual SubscriptionPlan? Plan { get; set; }

        /// <summary>Amount billed for one cycle, in the platform currency.</summary>
        public decimal Amount { get; set; }

        /// <summary>Cycle length in months (1 = monthly).</summary>
        public int BillingCycleMonths { get; set; } = 1;

        /// <summary>Gym-specific grace days; null uses the platform default.</summary>
        public int? GracePeriodDaysOverride { get; set; }

        /// <summary>Gym-specific reminder lead days; null uses the platform default.</summary>
        public int? ReminderLeadDaysOverride { get; set; }

        /// <summary>First day of the first billing cycle; the anchor for every later period.</summary>
        public DateOnly BillingStartDate { get; set; }

        /// <summary>Due date of the earliest unpaid invoice (display/notification aid).</summary>
        public DateOnly NextDueDate { get; set; }

        public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Active;

        /// <summary>
        /// When false, overdue invoices stay in grace and never auto-suspend this gym.
        /// </summary>
        public bool AutoSuspensionEnabled { get; set; } = true;

        public DateTime? SuspendedAtUtc { get; set; }
        public string? SuspensionReason { get; set; }

        /// <summary>
        /// True for an administrator-initiated suspension, which a payment does not
        /// clear automatically. Automatic suspensions set this to false so recording
        /// the outstanding payment restores access without manual intervention.
        /// </summary>
        public bool IsSuspensionManual { get; set; }

        public DateTime? CancelledAtUtc { get; set; }

        /// <summary>
        /// An administrator reactivation that keeps access open through this date even
        /// while an invoice is past its grace window. The sweep resumes normal
        /// suspension once the date elapses, so an override can never become indefinite.
        /// </summary>
        public DateOnly? AccessOverrideUntil { get; set; }

        public virtual ICollection<SubscriptionInvoice> Invoices { get; set; } = new List<SubscriptionInvoice>();
    }
}
