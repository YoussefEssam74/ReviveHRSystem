using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.NotificationModule
{
    /// <summary>
    /// Represents an actionable item in the HR management queue requiring explicit review or resolution.
    /// Alerts HR about expiring contracts, expiring employee documents, pending vacancy requests, or resignation follow-ups.
    /// </summary>
    public class Event : BaseEntity
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public EventType Type { get; set; }
        public string EntityType { get; set; } = string.Empty;
        public int EntityId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public EventStatus Status { get; set; } = EventStatus.Open;

        public int? ResolvedBy { get; set; }
        public virtual User? Resolver { get; set; }

        public DateTime? ResolvedAt { get; set; }
    }
}
