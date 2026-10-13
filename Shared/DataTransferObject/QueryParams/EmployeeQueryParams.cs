namespace Shared.DataTransferObject.QueryParams
{
    /// <summary>
    /// Employee directory filters (mock §21): free-text match on the full name,
    /// employment-status filter and a position filter. Scope (team vs gym) is never
    /// taken from the client — it is resolved server-side from the actor's role
    /// in the token's gym (ADR-003 Amendment 1).
    /// </summary>
    public sealed class EmployeeQueryParams : PaginationParams
    {
        /// <summary>Case-insensitive substring match on the employee's full name.</summary>
        public string? Q { get; set; }

        /// <summary>Employment status name (Active | OnLeave | Suspended | Terminated).</summary>
        public string? Status { get; set; }

        /// <summary>Restricts the directory to one position of the active gym.</summary>
        public int? PositionId { get; set; }

        /// <summary>Sort key: name (default) or status.</summary>
        public string? SortBy { get; set; }
    }
}
