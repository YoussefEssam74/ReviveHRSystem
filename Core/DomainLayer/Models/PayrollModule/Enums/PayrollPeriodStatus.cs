namespace DomainLayer.Models.PayrollModule.Enums
{
    /// <summary>
    /// Represents the operational status of a payroll calculation cycle.
    /// Open (entries being prepared / deductions collected), Approved (signed off by HR Manager), Locked (finalized for payment).
    /// </summary>
    public enum PayrollPeriodStatus
    {
        Open = 1,
        Approved = 2,
        Locked = 3
    }
}
