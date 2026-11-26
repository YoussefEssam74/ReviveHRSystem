namespace DomainLayer.Models.SubscriptionModule.Enums
{
    /// <summary>
    /// Billing lifecycle of a gym's HR-service subscription.
    /// Active (current), GracePeriod (past due, access retained),
    /// Suspended (access blocked), Cancelled (service terminated).
    /// </summary>
    public enum SubscriptionStatus
    {
        Active = 1,
        GracePeriod = 2,
        Suspended = 3,
        Cancelled = 4
    }
}
