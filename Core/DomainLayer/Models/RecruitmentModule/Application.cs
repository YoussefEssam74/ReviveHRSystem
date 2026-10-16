using DomainLayer.Models.RecruitmentModule.Enums;

namespace DomainLayer.Models.RecruitmentModule
{
    /// <summary>
    /// Represents an active or historical job application connecting a Candidate to a specific Vacancy.
    /// Tracks current Kanban pipeline stage, overall application status (InProgress, Hired, Rejected, WaitingList), and stages.
    /// </summary>
    public class Application : BaseEntity<int>
    {
        /// <summary>Null for hiring-form conversions — no vacancy posting backs them (shown via PositionTitle).</summary>
        public int? VacancyId { get; set; }
        public virtual Vacancy? Vacancy { get; set; }

        public int CandidateId { get; set; }
        public virtual Candidate Candidate { get; set; } = null!;

        /// <summary>Position label for vacancy-less applications (form conversions).</summary>
        public string? PositionTitle { get; set; }

        public DateTime AppliedDate { get; set; } = DateTime.UtcNow;
        public PipelineStageType CurrentStage { get; set; } = PipelineStageType.Applied;
        public ApplicationStatus Status { get; set; } = ApplicationStatus.InProgress;

        // ---- Application-form data (the UI's `form` object) ----
        /// <summary>Where the applicant came from ("Job board", "Referral", "Hiring Form — X", …).</summary>
        public string? Source { get; set; }
        public string? PreferredGym { get; set; }
        public int ExperienceYears { get; set; }
        public string? Education { get; set; }
        /// <summary>JSON array of language strings.</summary>
        public string? LanguagesJson { get; set; }
        public string? ShiftPreference { get; set; }
        public decimal? SalaryExpectation { get; set; }
        public string? Availability { get; set; }
        /// <summary>Free note carried on the waiting-list entry.</summary>
        public string? Notes { get; set; }

        // ---- Terminal outcomes (the UI's decision / hiredDate / rejectedDate blocks) ----
        public DateTime? HiredDate { get; set; }
        public int? HiredBy { get; set; }
        public DateTime? RejectedAt { get; set; }
        public int? RejectedBy { get; set; }
        public string? RejectReason { get; set; }
        public int? DecisionBy { get; set; }
        public DateTime? DecisionAt { get; set; }
        public string? DecisionNote { get; set; }

        /// <summary>When the candidate last moved stage — drives the follow-up (staleness) engine.</summary>
        public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;

        public virtual ICollection<PipelineStage> PipelineStages { get; set; } = new List<PipelineStage>();
        public virtual ICollection<Interview> Interviews { get; set; } = new List<Interview>();
    }
}

