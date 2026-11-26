using DomainLayer.Models.BillingModule.Enums;

namespace DomainLayer.Models.BillingModule
{
    /// <summary>
    /// A subscription invoice raised against one company for one billing period.
    /// InvoiceNumber follows INV-{yyyy}-{sequence:D4} and is never reused.
    /// </summary>
    public class Invoice : BaseEntity<int>
    {
        public string InvoiceNumber { get; set; } = string.Empty;

        public int CompanyId { get; set; }
        public virtual PlatformModule.Company Company { get; set; } = null!;

        public int? SubscriptionId { get; set; }
        public virtual CompanySubscription? Subscription { get; set; }

        public DateTime PeriodStart { get; set; }
        public DateTime PeriodEnd { get; set; }

        /// <summary>Display form of the period, e.g. "Nov 2026".</summary>
        public string PeriodLabel { get; set; } = string.Empty;

        public decimal Amount { get; set; }
        public string Currency { get; set; } = "EGP";
        public InvoiceStatus Status { get; set; } = InvoiceStatus.Open;

        public DateTime IssuedOn { get; set; }
        public DateTime DueOn { get; set; }
        public DateTime? PaidOn { get; set; }
        public string? Notes { get; set; }

        /// <summary>Denormalised total of recorded payments; keeps the ledger query cheap.</summary>
        public decimal AmountPaid { get; set; }

        public virtual ICollection<InvoicePayment> Payments { get; set; } = new List<InvoicePayment>();
    }
}
