using DomainLayer.Models.BillingModule.Enums;

namespace DomainLayer.Models.BillingModule
{
    /// <summary>
    /// One received payment against an invoice. Partial payments are allowed; the parent
    /// invoice settles (status Paid, PaidOn set) only when AmountPaid reaches Amount.
    /// </summary>
    public class InvoicePayment : BaseEntity<int>
    {
        public int InvoiceId { get; set; }
        public virtual Invoice Invoice { get; set; } = null!;

        public decimal Amount { get; set; }
        public DateTime PaidOn { get; set; }
        public PaymentMethod Method { get; set; } = PaymentMethod.BankTransfer;

        /// <summary>Bank transfer reference, gateway reference, receipt number, etc.</summary>
        public string? Reference { get; set; }

        public int? RecordedByUserId { get; set; }
    }
}
