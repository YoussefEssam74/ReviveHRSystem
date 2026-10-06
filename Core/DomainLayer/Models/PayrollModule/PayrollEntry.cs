using DomainLayer.Models.EmployeeModule;

namespace DomainLayer.Models.PayrollModule
{
    /// <summary>
    /// Represents the calculated individual payslip for an employee within a specific PayrollPeriod.
    /// Captures base salary, calculated total deductions, approved bonuses/overtime, and resulting net pay.
    /// </summary>
    public class PayrollEntry : BaseEntity
    {
        public int PayrollPeriodId { get; set; }
        public virtual PayrollPeriod PayrollPeriod { get; set; } = null!;

        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public decimal BaseSalary { get; set; }
        public decimal TotalDeductions { get; set; }
        public decimal TotalBonuses { get; set; }
        public decimal NetPay { get; set; }
    }
}
