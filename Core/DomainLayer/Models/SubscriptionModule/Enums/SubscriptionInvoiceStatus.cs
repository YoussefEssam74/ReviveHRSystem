namespace DomainLayer.Models.SubscriptionModule.Enums
{
    /// <summary>Collection state of one subscription invoice.</summary>
    public enum SubscriptionInvoiceStatus
    {
        Pending = 1,
        Paid = 2,
        Overdue = 3,
        Void = 4
    }
}
