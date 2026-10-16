namespace Shared.DataTransferObject.QueryParams
{
    /// <summary>
    /// Attendance day-view filters (mock §22): a single day (defaults to today) or an
    /// inclusive range, optionally narrowed to one employee or one status. Gym scope
    /// comes from the token, never from the query.
    /// </summary>
    public sealed class AttendanceQueryParams : PaginationParams
    {
        /// <summary>
        /// Longest window a single request may cover. Without a bound, a full-range
        /// request materialises every person-day of the scope into memory before paging.
        /// </summary>
        public const int MaxRangeDays = 92;

        /// <summary>Single day (YYYY-MM-DD). Ignored when a range is supplied.</summary>
        public DateOnly? Date { get; set; }

        /// <summary>Inclusive lower bound of the range (YYYY-MM-DD).</summary>
        public DateOnly? DateFrom { get; set; }

        /// <summary>Inclusive upper bound of the range (YYYY-MM-DD).</summary>
        public DateOnly? DateTo { get; set; }

        /// <summary>Narrows the result to one in-scope employee.</summary>
        public int? EmployeeId { get; set; }

        /// <summary>Attendance status (On Time | Late | Absent | Early Checkout | Missing Checkout).</summary>
        public string? Status { get; set; }

        /// <summary>Resolved window length in days (inclusive), after the swap of a reversed range.</summary>
        public int RangeDays =>
            (DateFrom is null || DateTo is null)
                ? 1
                : Math.Abs(DateTo.Value.DayNumber - DateFrom.Value.DayNumber) + 1;
    }
}
