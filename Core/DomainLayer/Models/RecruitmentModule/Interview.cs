using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.RecruitmentModule
{
    /// <summary>
    /// Records an interview scheduled or conducted with an applicant.
    /// Tracks interview stage, date, outcome (Passed, Failed, Pending), interviewer notes, and interviewer user.
    /// </summary>
    public class Interview : BaseEntity
    {
        public int ApplicationId { get; set; }
        public virtual Application Application { get; set; } = null!;

        public PipelineStageType Stage { get; set; }
        public DateTime ScheduledDate { get; set; }
        public InterviewOutcome Outcome { get; set; } = InterviewOutcome.Pending;
        public string? InterviewerNotes { get; set; }

        public int? ConductedBy { get; set; }
        public virtual User? Interviewer { get; set; }
    }
}
