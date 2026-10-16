namespace DomainLayer.Models.SchedulingModule.Enums
{
    /// <summary>
    /// Represents the publication status of a shift schedule cycle.
    /// Draft (editable by HR/Branch Manager), Published (live and visible to employees), Archived.
    /// </summary>
    public enum ShiftCycleStatus
    {
        Draft = 1,
        Published = 2,
        Archived = 3
    }
}
