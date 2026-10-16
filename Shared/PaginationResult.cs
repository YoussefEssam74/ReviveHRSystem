namespace Shared
{
    /// <summary>
    /// Paginated envelope returned by list endpoints (see <c>api.md</c> §Conventions):
    /// <c>{ items, page, pageSize, totalCount, totalPages }</c>. A bare array is never
    /// returned for a paged collection, so clients can render pager controls without
    /// a second round-trip.
    /// </summary>
    public class PaginationResult<TEntity>
    {
        public PaginationResult(int page, int pageSize, int totalCount, IEnumerable<TEntity> items)
        {
            // Guarded so a malformed request can never produce a nonsensical envelope.
            Page = page < 1 ? 1 : page;
            PageSize = pageSize < 1 ? 1 : pageSize;
            TotalCount = totalCount < 0 ? 0 : totalCount;
            Items = items;
        }

        /// <summary>1-based index of the returned page.</summary>
        public int Page { get; init; }

        /// <summary>Page size the results were sliced with.</summary>
        public int PageSize { get; init; }

        /// <summary>Total number of matching items across all pages.</summary>
        public int TotalCount { get; init; }

        /// <summary>
        /// Number of pages implied by <see cref="TotalCount"/> and <see cref="PageSize"/>;
        /// never below 1, so a pager on an empty result still renders one (disabled) page.
        /// </summary>
        public int TotalPages => Math.Max(1, (int)Math.Ceiling(TotalCount / (double)PageSize));

        /// <summary>The page's items, already sliced.</summary>
        public IEnumerable<TEntity> Items { get; init; }
    }
}
