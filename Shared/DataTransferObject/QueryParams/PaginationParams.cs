namespace Shared.DataTransferObject.QueryParams
{
    /// <summary>
    /// Base paging inputs shared by every list endpoint. Modeled on
    /// <c>ProductQueryParams</c>, but hardening the two things that class leaves open:
    /// <see cref="PageNumber"/> has no floor (0 or negative produces a negative
    /// <c>Skip</c>, which throws) and <see cref="PageSize"/> only clamps the upper bound
    /// (0 or negative silently returns an empty page). Both are clamped here.
    /// </summary>
    public abstract class PaginationParams
    {
        /// <summary>Page size used when the client omits it.</summary>
        public const int DefaultPageSize = 10;

        /// <summary>Upper bound a single page may request.</summary>
        public const int MaxPageSize = 100;

        private int pageNumber = 1;
        private int pageSize = DefaultPageSize;

        /// <summary>1-based page index; values below 1 are read back as 1.</summary>
        public int PageNumber
        {
            get => pageNumber;
            set => pageNumber = value < 1 ? 1 : value;
        }

        /// <summary>
        /// Page size; below 1 falls back to <see cref="DefaultPageSize"/>, above
        /// <see cref="MaxPageSize"/> is clamped down.
        /// </summary>
        public int PageSize
        {
            get => pageSize;
            set => pageSize = value < 1 ? DefaultPageSize : Math.Min(value, MaxPageSize);
        }

        /// <summary>
        /// Number of rows to skip for the current page. Computed in <see cref="long"/> and
        /// saturated, because an extreme pageNumber would otherwise overflow the multiply
        /// and produce a negative Skip — which Enumerable.Skip rejects with a 500.
        /// </summary>
        public long Skip => ((long)PageNumber - 1) * PageSize;

        /// <summary>
        /// <see cref="Skip"/> clamped into the int range Enumerable.Skip accepts, so a
        /// huge pageNumber simply requests a page beyond the end (empty items, intact
        /// totalCount) instead of failing the request.
        /// </summary>
        public int SkipCount => Skip > int.MaxValue ? int.MaxValue : (int)Skip;
    }
}
