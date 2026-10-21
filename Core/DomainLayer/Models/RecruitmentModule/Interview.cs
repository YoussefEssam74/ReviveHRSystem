using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.RecruitmentModule
{
    /// <summary>
    /// Records an interview scheduled or conducted with an applicant.
    /// Tracks interview stage, date, outcome (Passed, Failed, Pending), interviewer notes, and interviewer user.
    /// </summary>
    public class Interview : BaseEntity<int>
    {
        public int ApplicationId { get; set; }
        public virtual Application Application { get; set; } = null!;

        public PipelineStageType Stage { get; set; }
        public DateTime ScheduledDate { get; set; }
        public InterviewOutcome Outcome { get; set; } = InterviewOutcome.Pending;
        public string? InterviewerNotes { get; set; }

        public int? ConductedBy { get; set; }
        public virtual User? Interviewer { get; set; }

        // ---- Fields the interview calendar renders ----
        /// <summary>Free-form format label: "On-site" | "Video" | "Trial" | "Panel".</summary>
        public string? Type { get; set; }
        /// <summary>Room or video link.</summary>
        public string? Room { get; set; }
        /// <summary>UI status: "Scheduled" | "Invited" | "Completed" | "Cancelled" | "Draft".</summary>
        public string Status { get; set; } = "Scheduled";
        /// <summary>"Scheduled" | "Invited" | "Pass" | "Fail" (the UI's verdict block).</summary>
        public string? Verdict { get; set; }
        public string? Evaluation { get; set; }
        public DateTime? CompletedAt { get; set; }
        /// <summary>Interviewer display name when the interviewer is not a system user.</summary>
        public string? InterviewerName { get; set; }
    }
}

