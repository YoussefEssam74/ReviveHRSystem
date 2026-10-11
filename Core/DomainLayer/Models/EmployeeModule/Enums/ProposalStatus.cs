namespace DomainLayer.Models.EmployeeModule.Enums
{
    /// <summary>
    /// Review status for Branch Manager proposals that HR must file (warning notices,
    /// bonus proposals - mirroring DeductionStatus for deductions). Pending items sit
    /// in the HR queue; HR's decision is final.
    /// </summary>
    public enum ProposalStatus
    {
        Pending = 1,
        Approved = 2,
        Rejected = 3
    }
}
