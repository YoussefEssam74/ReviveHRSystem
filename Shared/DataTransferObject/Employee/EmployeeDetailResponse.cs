using Shared.DataTransferObject.Gym;

namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Full employee profile (GET/PUT /api/employees/{id} and the status-change
    /// response). SystemRole is populated once role assignment lands; branches lists
    /// the gyms the employee's user account may access (the gym switcher data).
    /// </summary>
    public class EmployeeDetailResponse
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
        public required string Email { get; init; }
        public string? Phone { get; init; }
        public decimal? Salary { get; init; }
        public string? SystemRole { get; init; }
        public IReadOnlyList<GymSummary>? Branches { get; init; }
    }

    /// <summary>
    /// The UI contract for create/detail wraps the profile in a data property
    /// ({ data: { … } }) — see api-spec-from-ui.md E2/E4.
    /// </summary>
    public class EmployeeDataResponse
    {
        public required EmployeeDetailResponse Data { get; init; }
    }
}
