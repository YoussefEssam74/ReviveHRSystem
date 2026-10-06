using DomainLayer.Models.EmployeeModule;

namespace DomainLayer.Models.SchedulingModule
{
    /// <summary>
    /// Represents the scheduled shift allocation for an employee on a specific calendar date.
    /// ShiftTemplateId is nullable to represent designated rest / Off days.
    /// Strictly enforced: unique per employee per date.
    /// </summary>
    public class ShiftAssignment : BaseEntity<int>
    {
        public int ShiftCycleId { get; set; }
        public virtual ShiftCycle ShiftCycle { get; set; } = null!;

        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public DateOnly Date { get; set; }

        public int? ShiftTemplateId { get; set; }
        public virtual ShiftTemplate? ShiftTemplate { get; set; }
    }
}

