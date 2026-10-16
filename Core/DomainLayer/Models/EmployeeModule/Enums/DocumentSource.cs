namespace DomainLayer.Models.EmployeeModule.Enums
{
    /// <summary>
    /// Who put an employee document on file. The two live in separate screens of the
    /// mock: the employee's own vault (§3 "All On-File Documents") and the official
    /// company documents HR published (§3.3 "HR UPLOADED"). Rows written before this
    /// discriminator existed were employee uploads, hence Employee = 0 keeps them
    /// correctly classified with no backfill.
    /// </summary>
    public enum DocumentSource
    {
        Employee = 0,
        Hr = 1
    }
}
