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
    public class DeductionCandidate : BaseEntity<int>
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public int? AttendanceRecordId { get; set; }
        public virtual AttendanceRecord? AttendanceRecord { get; set; }

        public decimal Amount { get; set; }

        /// <summary>
        /// The size the manager chose, in <see cref="DeductionUnit"/> (hours or days).
        /// Zero means nobody has sized the row yet — the sweep raises the day, the branch
        /// manager prices it.
        /// </summary>
        public decimal DeductionValue { get; set; }

        public DeductionUnit DeductionUnit { get; set; } = DeductionUnit.Days;

        /// <summary>
        /// The same size expressed in salary days (hours are converted through the two
        /// rates), so payroll and the review screens can keep counting in days.
        /// </summary>
        public decimal DeductionDays { get; set; }

        /// <summary>
        /// The day this deduction punishes. One employee can carry at most one
        /// deduction per day — the unique index on (EmployeeId, DeductionDate)
        /// enforces it even when two sweeps race.
        /// </summary>
        public DateOnly DeductionDate { get; set; }

        /// <summary>True when the attendance sweep raised the row; false for manager-issued rows.</summary>
        public bool IsSystemGenerated { get; set; }

        /// <summary>Category picked by the issuing manager (e.g. "Unapproved absence").</summary>
        public string Reason { get; set; } = string.Empty;

        /// <summary>Free-text context for the HR reviewer.</summary>
        public string? Note { get; set; }

        public int IssuedBy { get; set; }
        public virtual User IssuedByUser { get; set; } = null!;

        public DateTime IssuedAt { get; set; } = DateTime.UtcNow;

        public DeductionStatus Status { get; set; } = DeductionStatus.Pending;

        public int? ReviewedBy { get; set; }
        public virtual User? Reviewer { get; set; }

        public DateTime? ReviewedAt { get; set; }
    }
}
