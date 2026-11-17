using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>
    /// A follow-up action raised by a Branch Manager / Team Leader about one of his
    /// team members (mock 13.5 / 19 Team Actions): a reminder, a scheduled meeting, an
    /// escalation, or the resolution that closes the item. The trail is preserved
    /// (never overwritten), so the most recent action drives <see cref="LastAction"/>.
    /// Scoped to the team it was raised in, which is how scope isolation is enforced —
    /// except for a Branch Manager acting on an employee nobody has assigned to a team
    /// yet: his scope is the whole gym roster, so that row hangs off no team
    /// (<see cref="TeamId"/> is null) and stays visible to him alone.
    /// </summary>
    public class TeamFollowUp : BaseEntity<int>
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public int? TeamId { get; set; }
        public virtual DomainLayer.Models.OrganizationModule.Team? Team { get; set; }

        public FollowUpActionType ActionType { get; set; }

        public FollowUpSeverity Severity { get; set; } = FollowUpSeverity.Medium;

        /// <summary>What the follow-up is about (the mock's "type").</summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>Most recent action taken — updated in place as the item progresses.</summary>
        public string? LastAction { get; set; }

        /// <summary>Free-form note carried by the latest action.</summary>
        public string? Note { get; set; }

        public bool IsResolved { get; set; } = false;

        public int RaisedByUserId { get; set; }
        public virtual User RaisedByUser { get; set; } = null!;
    }
}
