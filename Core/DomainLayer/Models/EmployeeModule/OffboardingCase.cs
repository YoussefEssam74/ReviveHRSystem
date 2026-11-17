using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>Tracks an employee separation and its exit checklist.</summary>
    public class OffboardingCase : BaseEntity<int>
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public DateOnly LastWorkingDate { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = "Open";

        /// <summary>"Resignation" | "Termination" (Events Leaving tab filter).</summary>
        public string SeparationType { get; set; } = "Resignation";
        public int InitiatedBy { get; set; }
        public virtual User InitiatedByUser { get; set; } = null!;
        public DateTime InitiatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }

        /// <summary>Free-text initiation notes (the offboard / termination modal's Notes field).</summary>
        public string? Notes { get; set; }

        // ------------------------------------------------------------------
        // Exit verdict (api-spec-from-ui.md §5.6 T5) — saved while Under Review,
        // required together with a complete checklist before T6 finalizes.
        // ------------------------------------------------------------------

        public string? FinalReason { get; set; }

        /// <summary>"none" | "owedToEmployee" | "employeeOwes".</summary>
        public string? SettlementDirection { get; set; }

        public decimal? SettlementAmount { get; set; }

        public string? SettlementNote { get; set; }

        /// <summary>"Eligible" | "Banned" (rehire verdict).</summary>
        public string? RehireStatus { get; set; }

        public string? RehireNote { get; set; }

        public virtual ICollection<OffboardingChecklistItem> ChecklistItems { get; set; } = new List<OffboardingChecklistItem>();
    }
}

