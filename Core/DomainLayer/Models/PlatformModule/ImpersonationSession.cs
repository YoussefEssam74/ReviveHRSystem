using DomainLayer.Models.BillingModule;

namespace DomainLayer.Models.PlatformModule
{
    /// <summary>
    /// A Super Admin act-as session ("Enter gym workspace"). The actor's own identity is
    /// preserved: every write performed during the session is stamped with
    /// <see cref="ActorUserId"/> plus this session id, never with the assumed role.
    /// Lifetime is capped at 60 minutes.
    /// </summary>
    public class ImpersonationSession : BaseEntity<int>
    {
        /// <summary>Always a TopManagement user — the only role holding platform.impersonate.</summary>
        public int ActorUserId { get; set; }
        public virtual UserModule.User ActorUser { get; set; } = null!;

        public int CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        /// <summary>Branch the session is scoped to; null means the company as a whole.</summary>
        public int? BranchId { get; set; }

        /// <summary>Role the actor behaves as inside the workspace (HR Manager by default).</summary>
        public int? EffectiveRoleId { get; set; }
        public virtual UserModule.Role? EffectiveRole { get; set; }

        public DateTime StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public DateTime ExpiresAt { get; set; }

        public string? IpAddress { get; set; }

        /// <summary>Required at start — why the Super Admin entered the workspace.</summary>
        public string? Reason { get; set; }
    }
}
