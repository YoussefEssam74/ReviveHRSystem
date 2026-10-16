using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>
    /// A one-to-one message sent by a Team Leader / Branch Manager to a team member
    /// (mock 13.8 "Message" button). Persisted rather than fire-and-forget so there
    /// is an audit trail of what was sent and by whom, and so the recipient sees it in
    /// his notification inbox.
    /// </summary>
    public class TeamMessage : BaseEntity<int>
    {
        public int FromUserId { get; set; }
        public virtual User FromUser { get; set; } = null!;

        public int ToEmployeeId { get; set; }
        public virtual Employee ToEmployee { get; set; } = null!;

        public string Body { get; set; } = string.Empty;
    }
}
