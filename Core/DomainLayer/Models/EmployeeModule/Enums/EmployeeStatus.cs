namespace DomainLayer.Models.EmployeeModule.Enums
{
    /// <summary>
    /// Represents the current employment standing of an employee.
    /// Active (working), OnLeave (approved long-term absence), Suspended, Terminated.
    /// </summary>
    public enum EmployeeStatus
    {
        Active = 1,
        OnLeave = 2,
        Suspended = 3,
        Terminated = 4
    }
}
