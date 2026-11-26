using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.SubscriptionModule.Enums;

namespace DomainLayer.Models.SubscriptionModule
{
    /// <summary>
    /// One billing period's invoice. Issued once per cycle, due on the period start,
    /// and collectable until its grace window ends. The reminder/overdue/suspension
    /// timestamps make the automated notifications idempotent.
    /// </summary>
    public class SubscriptionInvoice : BaseEntity<int>
    {
        public int SubscriptionId { get; set; }
        public virtual GymSubscription Subscription { get; set; } = null!;

        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public string InvoiceNumber { get; set; } = string.Empty;

        /// <summary>First day covered by this invoice (inclusive).</summary>
        public DateOnly PeriodStart { get; set; }

        /// <summary>Day after the last covered day (exclusive).</summary>
        public DateOnly PeriodEnd { get; set; }

        public DateOnly DueDate { get; set; }
        public DateOnly GraceEndsOn { get; set; }

        public decimal Amount { get; set; }
        public decimal AmountPaid { get; set; }

        public SubscriptionInvoiceStatus Status { get; set; } = SubscriptionInvoiceStatus.Pending;

        public DateTime IssuedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? PaidAtUtc { get; set; }

        /// <summary>Set once the pre-due payment reminder has been sent.</summary>
        public DateTime? ReminderSentAtUtc { get; set; }

        /// <summary>Set once the overdue notice has been sent.</summary>
        public DateTime? OverdueNoticeSentAtUtc { get; set; }

        /// <summary>Set once this invoice triggered an automatic suspension.</summary>
        public DateTime? AutoSuspensionAppliedAtUtc { get; set; }

        public virtual ICollection<SubscriptionPayment> Payments { get; set; } = new List<SubscriptionPayment>();
    }
}
