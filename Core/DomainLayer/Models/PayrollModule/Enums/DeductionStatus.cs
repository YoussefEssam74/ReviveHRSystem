namespace DomainLayer.Models.PayrollModule.Enums
{
    /// <summary>
    /// Represents review status for an attendance-generated penalty / deduction candidate.
    /// Pending (raised, awaiting the branch decision), BranchApproved (branch accepted, awaiting the HR payroll application),
    /// Approved (applied to payroll entry), Rejected (excused).
    /// </summary>
    public enum DeductionStatus
    {
        Pending = 1,
        Approved = 2,
        Rejected = 3,
        BranchApproved = 4
    }
}
