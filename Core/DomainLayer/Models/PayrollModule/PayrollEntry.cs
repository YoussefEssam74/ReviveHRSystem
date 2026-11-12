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

        // --- Attendance reconciliation corrections ---------------------------------
        // DaysWorked and OvertimeHours above are edited in place; the four counters
        // below are derived from attendance records, so a manual correction is stored
        // as an override (null = derive from the records). The raw punch log always
        // stays visible as the evidence behind the corrected number.

        /// <summary>Corrected weekly-off count (null = count the Off records).</summary>
        public int? WeeklyOffsOverride { get; set; }

        /// <summary>Corrected approved-leave days (null = sum the approved leave requests).</summary>
        public int? ApprovedLeavesOverride { get; set; }

        /// <summary>Corrected late-arrival count (null = count the Late records).</summary>
        public int? LateArrivalsOverride { get; set; }

        /// <summary>Corrected unexcused-absence count (null = count the Absent records).</summary>
        public int? UnexcusedAbsencesOverride { get; set; }

        /// <summary>When the sheet's attendance numbers were last corrected by hand.</summary>
        public DateTime? AttendanceAdjustedAt { get; set; }

        /// <summary>Who applied the correction (null for seeded rows).</summary>
        public int? AttendanceAdjustedBy { get; set; }

        /// <summary>"Draft" | "Reviewed" (closed &amp; settled) | "Locked" (published with the branch).</summary>
        public string Status { get; set; } = "Draft";

        /// <summary>Set by the close-and-settle action; cleared by reopen.</summary>
        public DateTime? ReviewedAt { get; set; }

        public virtual ICollection<PayrollEntryLineItem> LineItems { get; set; } = new List<PayrollEntryLineItem>();
    }
}

