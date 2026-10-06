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

        // String type for business flexibility without schema migration
        public string Type { get; set; } = string.Empty;

        public DateOnly RequestDate { get; set; }
        public DateOnly? TargetStartDate { get; set; }
        public DateOnly? TargetEndDate { get; set; }
        public TimeOnly? TargetTime { get; set; }

        public int? SwapWithEmployeeId { get; set; }
        public virtual Employee? SwapWithEmployee { get; set; }

        public decimal? OvertimeHoursRequested { get; set; }
        public string Details { get; set; } = string.Empty;
        public string? AttachmentPath { get; set; }

        public RequestStatus Status { get; set; } = RequestStatus.Pending;

        public virtual ICollection<RequestDecision> Decisions { get; set; } = new List<RequestDecision>();
    }
}

