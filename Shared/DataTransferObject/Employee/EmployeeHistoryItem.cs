namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// One employment-history row (GET /api/employees/{id}/history) rendered by the
    /// Employment History tab: change type, before/after values, effective date, and
    /// the reason recorded with the change.
    /// </summary>
    public class EmployeeHistoryItem
    {
        public required string Type { get; init; }
        public string? From { get; init; }
        public string? To { get; init; }
        public DateOnly Date { get; init; }
        public string? Detail { get; init; }
    }
}
