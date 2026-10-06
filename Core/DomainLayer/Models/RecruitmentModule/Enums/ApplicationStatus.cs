namespace DomainLayer.Models.RecruitmentModule.Enums
{
    /// <summary>
    /// Represents the overall status of a job application.
    /// InProgress (active in pipeline), Hired (converted to employee), Rejected, WaitingList (kept for future hiring).
    /// </summary>
    public enum ApplicationStatus
    {
        InProgress = 1,
        Hired = 2,
        Rejected = 3,
        WaitingList = 4
    }
}
