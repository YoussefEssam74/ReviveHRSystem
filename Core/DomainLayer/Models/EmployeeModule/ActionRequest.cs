using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>
    /// An employee action escalated for HR decision (the Events page "Escalated" tab,
    /// api-spec-from-ui.md §9.4). Approving executes the effect server-side
    /// (gym transfer / salary change / role assignment / offboarding / bulk import).
    /// Transfer-type requests also surface on the Events "Transfers" tab.
    /// </summary>
    public class ActionRequest : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public int? EmployeeId { get; set; }
        public virtual Employee? Employee { get; set; }

        /// <summary>"Transfer" | "CompensationChange" | "RoleAssign" | "Offboard" | "BulkImport".</summary>
        public string ActionType { get; set; } = string.Empty;

        /// <summary>JSONB of the proposed change ({ fromGym, toGym, effectiveDate, currentSalary, newSalary, systemRole, lastDay, reason, source }).</summary>
        public string ProposedDetailsJson { get; set; } = "{}";

        public string Justification { get; set; } = string.Empty;

        public int RequestedById { get; set; }
        public virtual User RequestedBy { get; set; } = null!;

        /// <summary>"Pending" | "Approved" | "Rejected".</summary>
        public string Status { get; set; } = "Pending";

        public DateTime SubmittedDate { get; set; } = DateTime.UtcNow;

        public int? ReviewedById { get; set; }
        public virtual User? ReviewedBy { get; set; }

        public DateTime? ReviewedDate { get; set; }
        public string? ReviewComment { get; set; }
    }
}
