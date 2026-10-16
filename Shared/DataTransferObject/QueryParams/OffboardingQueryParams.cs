namespace Shared.DataTransferObject.QueryParams
{
    /// <summary>Leaving-case filters (mock §24).</summary>
    public sealed class OffboardingQueryParams : PaginationParams
    {
        /// <summary>Case status (Draft | Notice Period | Cancelled | Completed).</summary>
        public string? Status { get; set; }
    }
}
