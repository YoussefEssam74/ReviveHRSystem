namespace DomainLayer.Models.BillingModule.Enums
{
    /// <summary>
    /// Invoice lifecycle: Draft → Open → Paid | Overdue | Void.
    /// <see cref="Trial"/> is terminal — a trial invoice carries no amount and is never payable.
    /// </summary>
    public enum InvoiceStatus
    {
        Draft = 1,
        Open = 2,
        Paid = 3,
        Overdue = 4,
        Trial = 5,
        Void = 6
    }
}
