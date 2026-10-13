namespace Shared.DataTransferObject.QueryParams
{
    /// <summary>
    /// Management request-inbox filters (mock §17): status pill plus the type and
    /// requested-date-range filters of the Requests page. Team scope is resolved
    /// server-side, so there is deliberately no <c>teamId</c> parameter — a client
    /// that could name a team could widen its own scope.
    /// </summary>
    public sealed class RequestQueryParams : PaginationParams
    {
        /// <summary>Request status (Pending | PendingHRReview | Approved | Rejected | Cancelled).</summary>
        public string? Status { get; set; }

        /// <summary>Request-type id or label (see GET /api/request-types).</summary>
        public string? Type { get; set; }

        /// <summary>Inclusive lower bound on the requested date.</summary>
        public DateOnly? DateFrom { get; set; }

        /// <summary>Inclusive upper bound on the requested date.</summary>
        public DateOnly? DateTo { get; set; }
    }
}
