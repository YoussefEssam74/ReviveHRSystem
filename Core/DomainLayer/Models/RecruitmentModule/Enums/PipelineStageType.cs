namespace DomainLayer.Models.RecruitmentModule.Enums
{
    /// <summary>
    /// Represents standard Kanban stages of candidate progression through recruitment.
    /// Applied -> Screening -> FirstInterview -> SecondInterview -> FinalDecision,
    /// plus the terminal states the pipeline UI renders as columns (Accepted, Rejected, Hired).
    /// </summary>
    public enum PipelineStageType
    {
        Applied = 1,
        Screening = 2,
        FirstInterview = 3,
        SecondInterview = 4,
        FinalDecision = 5,
        Accepted = 6,
        Rejected = 7,
        Hired = 8
    }
}
