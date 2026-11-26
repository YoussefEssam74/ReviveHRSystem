namespace DomainLayer.Models.SubscriptionModule.Enums
{
    /// <summary>Review state of a gym-initiated subscription request.</summary>
    public enum SubscriptionRequestStatus
    {
        Pending = 1,
        Approved = 2,
        Rejected = 3,
        Cancelled = 4
    }
}
