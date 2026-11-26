using DomainLayer.Models.BillingModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.PlatformModule.Enums;

namespace DomainLayer.Models.PlatformModule
{
    /// <summary>
    /// The subscribing gym company — the tenant that owns one or more branches
    /// (<see cref="Gym"/>) and carries the subscription, seat limit and invoices.
    /// Introduced with the Super Admin console: before it, <see cref="Gym"/> was the
    /// only organization level and meant a single physical branch, so there was nowhere
    /// to attach commercial terms.
    /// </summary>
    public class Company : BaseEntity<int>
    {
        /// <summary>Trading name shown across the console, e.g. "Iron House Gym".</summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>Short unique handle used as the branch-code prefix, e.g. "IH-AL". Immutable after creation.</summary>
        public string Code { get; set; } = string.Empty;

        public string? City { get; set; }
        public string? LogoUrl { get; set; }

        public CompanyStatus Status { get; set; } = CompanyStatus.Trial;

        public string? ContactName { get; set; }
        public string? ContactEmail { get; set; }
        public string? ContactPhone { get; set; }

        /// <summary>
        /// When the account was provisioned. Declared explicitly (rather than relying on
        /// the DbContext's shadow column) because the console shows it on the account card.
        /// The context still stamps it on insert.
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Set when the company is closed; Closed is terminal, restore is not offered.</summary>
        public DateTime? ClosedAt { get; set; }

        // Navigations
        public virtual ICollection<Gym> Branches { get; set; } = new List<Gym>();
        public virtual ICollection<CompanySubscription> Subscriptions { get; set; } = new List<CompanySubscription>();
        public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
        public virtual ICollection<ImpersonationSession> ImpersonationSessions { get; set; } = new List<ImpersonationSession>();
    }
}
