namespace DomainLayer.Models.PlatformModule.Enums
{
    /// <summary>
    /// Lifecycle state of a subscribed gym company (tenant).
    /// Trial and PaymentOverdue are written by the billing jobs; Suspended and Closed
    /// are explicit Super Admin actions. Closed is terminal — the company is never
    /// hard-deleted so financial and audit history survive.
    /// </summary>
    public enum CompanyStatus
    {
        Trial = 1,
        Active = 2,
        PaymentOverdue = 3,
        Suspended = 4,
        Closed = 5
    }
}
