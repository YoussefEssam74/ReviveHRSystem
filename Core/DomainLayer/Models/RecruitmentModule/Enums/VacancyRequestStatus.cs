namespace DomainLayer.Models.RecruitmentModule.Enums
{
    /// <summary>
    /// Represents the approval status of a Branch Manager's vacancy request.
    /// Pending (awaiting HR review), Approved (approved by HR to open a vacancy), Rejected.
    /// </summary>
    public enum VacancyRequestStatus
    {
        Pending = 1,
        Approved = 2,
        Rejected = 3
    }
}
