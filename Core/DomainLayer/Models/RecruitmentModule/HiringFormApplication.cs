namespace DomainLayer.Models.RecruitmentModule
{
    /// <summary>
    /// An anonymous submission of a HiringForm (api-spec-from-ui.md §5.2).
    /// Deliberately separate from the pipeline Application (which joins a Candidate to
    /// a Vacancy): a form submission only becomes a pipeline candidate when HR clicks
    /// "Add to Pipeline" (CandidateId is then set and Status flips to "Moved to Pipeline").
    /// </summary>
    public class HiringFormApplication : BaseEntity<int>
    {
        public int HiringFormId { get; set; }
        public virtual HiringForm HiringForm { get; set; } = null!;

        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;

        /// <summary>Preferred gym branch name as typed on the public form.</summary>
        public string? Gym { get; set; }

        /// <summary>Position typed on the careers application (falls back to the form's position).</summary>
        public string? Position { get; set; }

        /// <summary>JSON object of the extra careers fields (source, expYears, education, skills, languages, shift, salaryExp, availability) — transferred to the pipeline Application on convert.</summary>
        public string? CareersJson { get; set; }

        /// <summary>JSON array of answers — [{ question, type, answer }].</summary>
        public string AnswersJson { get; set; } = "[]";

        /// <summary>"New" | "In Review" | "Shortlisted" | "Rejected" | "Moved to Pipeline".</summary>
        public string Status { get; set; } = "New";

        public DateTime AppliedDate { get; set; } = DateTime.UtcNow;

        public string? RejectComment { get; set; }

        /// <summary>Pipeline candidate created by the convert action (null until converted).</summary>
        public int? CandidateId { get; set; }
        public virtual Candidate? Candidate { get; set; }
    }
}
