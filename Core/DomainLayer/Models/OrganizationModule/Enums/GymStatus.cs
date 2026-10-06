namespace DomainLayer.Models.OrganizationModule.Enums
{
    /// <summary>
    /// Represents the operational state of a gym branch.
    /// Active (operating), Inactive (temporarily paused), Archived (closed).
    /// </summary>
    public enum GymStatus
    {
        Active = 1,
        Inactive = 2,
        Archived = 3
    }
}
