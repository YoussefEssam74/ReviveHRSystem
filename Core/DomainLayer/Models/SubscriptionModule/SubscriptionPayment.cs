using DomainLayer.Models.OrganizationModule;

namespace DomainLayer.Models.SubscriptionModule
{
    /// <summary>
    /// A confirmed subscription payment recorded by Revive Admin. One row is written
    /// per invoice allocation so the ledger reconciles invoice-by-invoice.
    /// </summary>
    public class SubscriptionPayment : BaseEntity<int>
    {
        public int InvoiceId { get; set; }
        public virtual SubscriptionInvoice Invoice { get; set; } = null!;

        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public decimal Amount { get; set; }
        public DateTime PaidAtUtc { get; set; }

        /// <summary>BankTransfer, Cash, Card, Cheque, Online or another free-text method.</summary>
        public string Method { get; set; } = "BankTransfer";

        public string? Reference { get; set; }
        public string? Notes { get; set; }

        public int? RecordedByUserId { get; set; }
    }
}
