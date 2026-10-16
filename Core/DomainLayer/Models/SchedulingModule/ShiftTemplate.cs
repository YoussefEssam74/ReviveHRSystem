using DomainLayer.Models.OrganizationModule;

namespace DomainLayer.Models.SchedulingModule
{
    /// <summary>
    /// Represents a reusable shift time definition created per gym (e.g., Morning Shift: 08:00 - 16:00, Night Shift: 16:00 - 00:00).
    /// Used by schedule planners to assign work hours.
    /// </summary>
    public class ShiftTemplate : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public string Name { get; set; } = string.Empty;
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public bool IsActive { get; set; } = true;
    }
}

