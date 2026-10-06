using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.PayrollModule
{
    /// <summary>
    /// Represents an attendance-triggered deduction (e.g. repeated lateness or unexcused absence) flagged for review.
    /// Before affecting payroll, an authorized HR manager reviews and either approves or waives the deduction.
    /// </summary>
    public class DeductionCandidate : BaseEntity
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public int? AttendanceRecordId { get; set; }
        public virtual AttendanceRecord? AttendanceRecord { get; set; }

        public decimal Amount { get; set; }
        public string Reason { get; set; } = string.Empty;
        public DeductionStatus Status { get; set; } = DeductionStatus.Pending;

        public int? ReviewedBy { get; set; }
        public virtual User? Reviewer { get; set; }

        public DateTime? ReviewedAt { get; set; }
    }
}
