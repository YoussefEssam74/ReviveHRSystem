namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Query options for the employee directory (GET /api/employees): gym filter,
    /// name search, status filter, and pager/sort controls. Gym scope is always
    /// enforced server-side from the caller's assignments.
    /// </summary>
    public class EmployeeListQuery
    {
        /// <summary>Restrict to one gym (must be one the caller may access).</summary>
        public int? Gym { get; init; }

        /// <summary>Case-insensitive substring of the employee's name.</summary>
        public string? Search { get; init; }

        /// <summary>Active | On Leave | Suspended | Terminated.</summary>
        public string? Status { get; init; }

        public int Page { get; init; } = 1;

        public int PageSize { get; init; } = 20;

        /// <summary>name (default) | hireDate | status.</summary>
        public string? SortBy { get; init; }

        /// <summary>asc (default) | desc.</summary>
        public string? SortOrder { get; init; }
    }
}
