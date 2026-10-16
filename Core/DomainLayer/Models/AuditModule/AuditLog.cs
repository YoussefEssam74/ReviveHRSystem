namespace DomainLayer.Models.AuditModule
{
    /// <summary>
    /// System-wide security and compliance audit log.
    /// Captures who (UserId), what action (Created, Updated, Deleted), target entity type and ID,
    /// before/after JSONB snapshots (OldValues / NewValues), timestamp, and IP address.
    /// </summary>
    public class AuditLog : BaseEntity<int>
    {
        public int? UserId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public int EntityId { get; set; }
        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string? IpAddress { get; set; }
    }
}

