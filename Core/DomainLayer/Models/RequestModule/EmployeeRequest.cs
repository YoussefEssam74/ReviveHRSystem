using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.RequestModule.Enums;

namespace DomainLayer.Models.RequestModule
{
    /// <summary>
    /// Represents an employee self-service submission (e.g. Leave, SickLeave, DayOff, ShiftSwap, Overtime, Resignation, DocumentRequest).
    /// Type is a flexible string to allow configurable business request types without schema migrations.
    /// Follows a two-stage approval workflow (Branch Manager -> HR final decision).
    /// </summary>
    public class EmployeeRequest : BaseEntity<int>
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public string Type { get; set; } = string.Empty;

        /// <summary>When the employee submitted the request (My Requests "Submitted" column).</summary>
        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

        public DateOnly RequestDate { get; set; }
        public DateOnly? TargetStartDate { get; set; }
        public DateOnly? TargetEndDate { get; set; }
        public TimeOnly? TargetTime { get; set; }

        public int? SwapWithEmployeeId { get; set; }
        public virtual Employee? SwapWithEmployee { get; set; }

        public decimal? OvertimeHoursRequested { get; set; }

        /// <summary>
        /// Excused hours a Late Attendance / Early Leave request covers, computed from the
        /// employee's published schedule at submission. Counted against the gym's monthly
        /// excused-hours cap (Gym.ExcusedLateHoursCapPerMonth) while pending or approved.
        /// </summary>
        public decimal? RequestedHours { get; set; }

        /// <summary>Amount asked for by a Salary Advance request.</summary>
        public decimal? RequestedAmount { get; set; }

        public string Details { get; set; } = string.Empty;
        public string? AttachmentPath { get; set; }

        public RequestStatus Status { get; set; } = RequestStatus.Pending;

        /// <summary>
        /// Submission timestamp surfaced as the UI's submittedDate / timeline origin.
        /// Maps onto the shared CreatedAt column (shadow-configured for every entity)
        /// so no schema change is required; stamped by the services on create.
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Payment outcome recorded by the HR approve decision (R3/R9): "paid"
        /// (deducted from the leave balance) or "unpaid" (payroll deduction).
        /// Null until approved, and for types that consume no balance.
        /// </summary>
        public string? Payment { get; set; }

        public virtual ICollection<RequestDecision> Decisions { get; set; } = new List<RequestDecision>();

        public virtual ICollection<RequestComment> Comments { get; set; } = new List<RequestComment>();
    }
}

