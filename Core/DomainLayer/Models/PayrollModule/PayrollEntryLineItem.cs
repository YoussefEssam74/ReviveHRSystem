using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.PayrollModule
{
    /// <summary>Auditable earning or deduction contributing to a payroll entry.</summary>
    public class PayrollEntryLineItem : BaseEntity<int>
    {
        public int PayrollEntryId { get; set; }
        public virtual PayrollEntry PayrollEntry { get; set; } = null!;

        public string Type { get; set; } = "Deduction";
        public string Label { get; set; } = string.Empty;
        public DateOnly EffectiveDate { get; set; }
        public decimal Amount { get; set; }
        public string? Reason { get; set; }
        public string Source { get; set; } = "Manual";
        public int? AttendanceRecordId { get; set; }
        public virtual AttendanceRecord? AttendanceRecord { get; set; }
        public int? EmployeeRequestId { get; set; }
        public virtual EmployeeRequest? EmployeeRequest { get; set; }
        public string Status { get; set; } = "Approved";
        public int? ReviewedBy { get; set; }
        public virtual User? Reviewer { get; set; }
        public DateTime? ReviewedAt { get; set; }
    }
}

