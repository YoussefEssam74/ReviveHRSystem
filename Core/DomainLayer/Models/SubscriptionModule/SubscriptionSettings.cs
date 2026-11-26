namespace DomainLayer.Models.SubscriptionModule
{
    /// <summary>
    /// Platform-wide subscription defaults (single row, Id = 1): billing cycle
    /// length, grace window, reminder lead time and whether overdue invoices
    /// suspend access automatically. Gyms may override cycle/grace/lead values.
    /// </summary>
    public class SubscriptionSettings : BaseEntity<int>
    {
        public int DefaultBillingCycleMonths { get; set; } = 1;
        public int DefaultGracePeriodDays { get; set; } = 7;

        /// <summary>How many days before the due date the payment reminder is sent.</summary>
        public int ReminderLeadDays { get; set; } = 3;

        public bool AutoSuspensionEnabled { get; set; } = true;

        public string Currency { get; set; } = "EGP";
    }
}
