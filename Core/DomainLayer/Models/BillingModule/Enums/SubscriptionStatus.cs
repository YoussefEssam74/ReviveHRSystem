namespace DomainLayer.Models.BillingModule.Enums
{
    /// <summary>State of a company's subscription to a plan.</summary>
    public enum SubscriptionStatus
    {
        Trial = 1,
        Active = 2,
        PastDue = 3,
        Cancelled = 4
    }
}
