namespace DomainLayer.Models.RecruitmentModule.Enums
{
    /// <summary>
    /// Represents the evaluation result of an interview session.
    /// Pending (scheduled/awaiting evaluation), Passed (advances stage), Failed (triggers rejection flow).
    /// </summary>
    public enum InterviewOutcome
    {
        Pending = 1,
        Passed = 2,
        Failed = 3
    }
}
