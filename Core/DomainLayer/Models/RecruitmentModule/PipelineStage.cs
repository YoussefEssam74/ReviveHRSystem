using DomainLayer.Models.RecruitmentModule.Enums;

namespace DomainLayer.Models.RecruitmentModule
{
    /// <summary>
    /// Tracks each stage progression an applicant moves through in the recruitment pipeline.
    /// Records date entered, required next actions with due dates, and completion outcomes for follow-up enforcement.
    /// </summary>
    public class PipelineStage : BaseEntity<int>
    {
        public int ApplicationId { get; set; }
        public virtual Application Application { get; set; } = null!;

        public PipelineStageType Stage { get; set; }
        public DateTime EnteredDate { get; set; } = DateTime.UtcNow;
        public string? RequiredAction { get; set; }
        public DateTime? ActionDueDate { get; set; }
        public DateTime? CompletedDate { get; set; }
        public string? Outcome { get; set; }
        public string? Notes { get; set; }
    }
}

