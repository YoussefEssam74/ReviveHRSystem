namespace DomainLayer.Models.BillingModule.Enums
{
    /// <summary>How a subscription payment was received.</summary>
    public enum PaymentMethod
    {
        BankTransfer = 1,
        Card = 2,
        Cash = 3,
        Other = 4
    }
}
