namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Pagination envelope for the employee directory: the requested page of items
    /// plus the pager fields the UI needs ({ items, …pager }).
    /// </summary>
    public class EmployeeListResponse
    {
        public required IReadOnlyList<EmployeeListItem> Items { get; init; }
        public int Page { get; init; }
        public int PageSize { get; init; }
        public int Total { get; init; }
        public int TotalPages { get; init; }
    }
}
