using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>
    /// A disciplinary warning notice raised by a Branch Manager for HR to file.
    /// The employee does not see the notice until HR approves and files it, so the
    /// proposal itself carries no employee-facing status.
    /// </summary>
    public class WarningNotice : BaseEntity<int>
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        /// <summary>Category: Attendance, Conduct, Performance, Safety, Policy violation.</summary>
        public string Type { get; set; } = string.Empty;

        public string Reason { get; set; } = string.Empty;

        /// <summary>What was said to the employee ("What was said to the employee" in the UI).</summary>
        public string? Note { get; set; }

        public int IssuedBy { get; set; }
        public virtual User IssuedByUser { get; set; } = null!;

        public DateTime IssuedAt { get; set; } = DateTime.UtcNow;

        public ProposalStatus Status { get; set; } = ProposalStatus.Pending;
    }
}
