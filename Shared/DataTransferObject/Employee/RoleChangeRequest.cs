namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// POST /api/employees/{id}/role-change body (E16): sets the employee's system
    /// role ("None (Employee)", "Branch Manager", "Team Leader", or any role name)
    /// and replaces their direct permission overrides with the supplied keys.
    /// </summary>
    public class RoleChangeRequest
    {
        public string? SystemRole { get; init; }
        public List<string>? Permissions { get; init; }
    }
}
