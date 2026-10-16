using DomainLayer.Models.EmployeeModule;

namespace DomainLayer.Models.PayrollModule
{
    /// <summary>
    /// Represents the calculated individual payslip for an employee within a specific PayrollPeriod.
    /// Captures base salary, calculated total deductions, approved bonuses/overtime, and resulting net pay.
    /// </summary>
    public class PayrollEntry : BaseEntity<int>
    {
        public int PayrollPeriodId { get; set; }
        public virtual PayrollPeriod PayrollPeriod { get; set; } = null!;

        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public decimal BaseSalary { get; set; }
        public decimal TotalDeductions { get; set; }
        public decimal TotalBonuses { get; set; }
        public decimal NetPay { get; set; }

        /// <summary>Attendance days counted into this sheet ("days" column).</summary>
        public int DaysWorked { get; set; }

        /// <summary>Overtime hours logged in the period (OT pay = (base/176)×1.5×hours).</summary>
        public decimal OvertimeHours { get; set; }

        /// <summary>"Draft" | "Reviewed" (closed &amp; settled) | "Locked" (published with the branch).</summary>
        public string Status { get; set; } = "Draft";

        /// <summary>Set by the close-and-settle action; cleared by reopen.</summary>
        public DateTime? ReviewedAt { get; set; }

        public virtual ICollection<PayrollEntryLineItem> LineItems { get; set; } = new List<PayrollEntryLineItem>();
    }
}

