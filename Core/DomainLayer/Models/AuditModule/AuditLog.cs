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

        /// <summary>Gym where the action happened (null for org-wide actions / legacy rows).</summary>
        public int? GymId { get; set; }

        /// <summary>Company (tenant) the action belongs to; null for platform-wide actions.</summary>
        public int? CompanyId { get; set; }

        /// <summary>Human-readable action label for the platform trail, e.g. "Suspended company account".</summary>
        public string? ActionLabel { get; set; }

        /// <summary>Grouping used by the console: Access | Billing | Gym | User | Settings | Security | Payroll | Data | Recruitment | Attendance.</summary>
        public string? Category { get; set; }

        /// <summary>info | warning | critical.</summary>
        public string? Severity { get; set; }

        /// <summary>What the action was performed on, e.g. "INV-2026-0418 · Flex Factory".</summary>
        public string? Target { get; set; }

        /// <summary>Free-text explanation shown in the event detail dialog.</summary>
        public string? Detail { get; set; }

        /// <summary>
        /// Impersonation session that produced this row, when the action was taken by a
        /// Super Admin acting inside a workspace. Keeps the actor attributable.
        /// </summary>
        public int? ImpersonationSessionId { get; set; }

        /// <summary>Set once when a critical/warning event is acknowledged. The only mutable field.</summary>
        public DateTime? ReviewedAt { get; set; }
        public int? ReviewedByUserId { get; set; }
    }
}

