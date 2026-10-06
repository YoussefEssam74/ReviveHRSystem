using DomainLayer.Models.RecruitmentModule.Enums;

namespace DomainLayer.Models.RecruitmentModule
{
    /// <summary>
    /// Represents an active or historical job application connecting a Candidate to a specific Vacancy.
    /// Tracks current Kanban pipeline stage, overall application status (InProgress, Hired, Rejected, WaitingList), and stages.
    /// </summary>
    public class Application : BaseEntity<int>
    {
        public int VacancyId { get; set; }
        public virtual Vacancy Vacancy { get; set; } = null!;

        public int CandidateId { get; set; }
        public virtual Candidate Candidate { get; set; } = null!;

        public DateTime AppliedDate { get; set; } = DateTime.UtcNow;
        public PipelineStageType CurrentStage { get; set; } = PipelineStageType.Applied;
        public ApplicationStatus Status { get; set; } = ApplicationStatus.InProgress;

        public virtual ICollection<PipelineStage> PipelineStages { get; set; } = new List<PipelineStage>();
        public virtual ICollection<Interview> Interviews { get; set; } = new List<Interview>();
    }
}

