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
        // HR approval of a termination request (Termination Requests tab).
        // "Pending" for a Branch-Manager request, "Approved" for HR-initiated
        // exits and legacy rows, "Rejected" when HR declines the request.
        // ------------------------------------------------------------------

        public string ApprovalStatus { get; set; } = "Approved";

        public int? ApprovedBy { get; set; }

        public virtual User? ApprovedByUser { get; set; }

        public DateTime? ApprovedAt { get; set; }

        public string? ApprovalNote { get; set; }

        // ------------------------------------------------------------------
        // Exit interview scheduling + form (Exit Interviews / Exit Interview tabs).
        // ------------------------------------------------------------------

        /// <summary>"Scheduled" | "Completed" | "No Show" | "Rescheduled" (null = not scheduled).</summary>
        public string? ExitInterviewStatus { get; set; }

        public DateTime? ExitInterviewScheduledAt { get; set; }

        public DateTime? ExitInterviewCompletedAt { get; set; }

        public string? Interviewer { get; set; }

        public DateOnly? InterviewDate { get; set; }

        public string? ReasonForLeaving { get; set; }

        public string? WhatLikedMost { get; set; }

        public string? WhatToImprove { get; set; }

        /// <summary>1–5 self-reported satisfaction scores captured in the interview.</summary>
        public int? JobSatisfaction { get; set; }

        public int? ManagementRating { get; set; }

        public int? WorkEnvironmentRating { get; set; }

        public int? CompensationRating { get; set; }

        public bool? WouldRecommend { get; set; }

        public string? InterviewNotes { get; set; }

        /// <summary>
        /// JSON question set of the exit interview: [{ id, label, kind, options, answer }].
        /// Lets HR rename/add/remove questions and keep their answers per case.
        /// Null = the canonical defaults built from the columns above.
        /// </summary>
        public string? ExitInterviewQuestions { get; set; }

        // ------------------------------------------------------------------
        // Clearance / final settlement (the last step before Former Employees).
        // ------------------------------------------------------------------

        public bool UniformReturned { get; set; }

        public bool AssetsReturned { get; set; }

        public bool AccessRevoked { get; set; }

        public bool FinalSettlementCompleted { get; set; }

        public bool ClearanceCompleted { get; set; }

        public DateTime? ClearanceCompletedAt { get; set; }

        public string? ClearanceNotes { get; set; }

        /// <summary>Hard do-not-rehire flag (kept apart from the rehire verdict).</summary>
        public bool Blacklisted { get; set; }

        public string? BlacklistReason { get; set; }

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

