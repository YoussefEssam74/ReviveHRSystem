using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.SchedulingModule;

namespace DomainLayer.Models.AttendanceModule
{
    /// <summary>
    /// Represents an employee's daily attendance entry.
    /// Captures check-in/out timestamps, check-in method (Biometric/Manual), evaluated status (OnTime, Late, Absent, etc.),
    /// and the scheduled shift template worked at this specific gym.
    /// </summary>
    public class AttendanceRecord : BaseEntity
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public DateOnly Date { get; set; }
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }

        public AttendanceMethod? CheckInMethod { get; set; }
        public AttendanceMethod? CheckOutMethod { get; set; }
        public AttendanceStatus Status { get; set; }

        public int? ScheduledShiftTemplateId { get; set; }
        public virtual ShiftTemplate? ScheduledShiftTemplate { get; set; }

        public virtual ICollection<AttendanceCorrection> Corrections { get; set; } = new List<AttendanceCorrection>();
    }
}
