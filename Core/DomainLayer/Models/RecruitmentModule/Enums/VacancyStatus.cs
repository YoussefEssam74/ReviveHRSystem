namespace DomainLayer.Models.RecruitmentModule.Enums
{
    /// <summary>
    /// Represents the publication lifecycle of a job vacancy.
    /// Open (accepting applicants via public link), Closed (hiring finished/paused), Archived.
    /// </summary>
    public enum VacancyStatus
    {
        Open = 1,
        Closed = 2,
        Archived = 3
    }
}
