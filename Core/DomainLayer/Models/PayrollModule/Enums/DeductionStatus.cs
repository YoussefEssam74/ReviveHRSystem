namespace DomainLayer.Models.PayrollModule.Enums
{
    /// <summary>
    /// Represents review status for an attendance-generated penalty / deduction candidate.
    /// Pending (system flagged, awaiting review), Approved (applied to payroll entry), Rejected (excused).
    /// </summary>
    public enum DeductionStatus
    {
        Pending = 1,
        Approved = 2,
        Rejected = 3
    }
}
