using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.SubscriptionModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.SubscriptionModule
{
    /// <summary>
    /// A gym-initiated renewal or plan-change request. Revive Admin reviews it;
    /// approval applies the requested plan and ensures the renewal invoice exists,
    /// after which the normal manual payment flow restores access.
    /// </summary>
    public class SubscriptionChangeRequest : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public SubscriptionRequestType Type { get; set; }
        public SubscriptionRequestStatus Status { get; set; } = SubscriptionRequestStatus.Pending;

        public int? CurrentPlanId { get; set; }
        public virtual SubscriptionPlan? CurrentPlan { get; set; }

        public int? RequestedPlanId { get; set; }
        public virtual SubscriptionPlan? RequestedPlan { get; set; }

        public int RequestedByUserId { get; set; }
        public virtual User RequestedBy { get; set; } = null!;
        public string? Note { get; set; }
        public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;

        public int? ReviewedByUserId { get; set; }
        public DateTime? ReviewedAtUtc { get; set; }
        public string? ReviewNote { get; set; }
    }
}
