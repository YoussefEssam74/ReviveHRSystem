using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.SchedulingModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.SchedulingModule
{
    /// <summary>
    /// Represents a dynamic multi-day scheduling period for a gym (e.g. 10-day cycle).
    /// Tracks schedule status (Draft, Published, Archived), start/end dates, and publishing user.
    /// </summary>
    public class ShiftCycle : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        /// <summary>
        /// Human-readable cycle label shown in the UI selector chips and header
        /// (e.g. "Sep 13 – Sep 22"). Null → the service derives it from the dates.
        /// </summary>
        public string? Label { get; set; }

        public DateOnly StartDate { get; set; }
        public DateOnly EndDate { get; set; }
        public ShiftCycleStatus Status { get; set; } = ShiftCycleStatus.Draft;

        public DateTime? PublishedAt { get; set; }
        public int? PublishedBy { get; set; }
        public virtual User? Publisher { get; set; }

        public virtual ICollection<ShiftAssignment> ShiftAssignments { get; set; } = new List<ShiftAssignment>();
    }
}

