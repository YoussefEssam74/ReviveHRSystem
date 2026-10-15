namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// One row of the employee directory (GET /api/employees): identity, position,
    /// gym, status, and the display fields the table/cards render. Salary is the
    /// employee's latest compensation amount (null when none has been recorded).
    /// </summary>
    public class EmployeeListItem
    {
        public int Id { get; init; }
        public required string EmployeeNumber { get; init; }
        public required string Name { get; init; }
        public required string Position { get; init; }
        public required string Level { get; init; }
        public int GymId { get; init; }
        public required string Gym { get; init; }
        public required string Status { get; init; }
        public required string Initials { get; init; }
        public DateOnly? HireDate { get; init; }
        public decimal? Salary { get; init; }
        public string? Phone { get; init; }
        public required string Email { get; init; }
    }
}
