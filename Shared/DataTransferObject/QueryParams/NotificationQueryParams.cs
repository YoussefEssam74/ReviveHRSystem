namespace Shared.DataTransferObject.QueryParams
{
    /// <summary>Notifications inbox filters (mock §11).</summary>
    public sealed class NotificationQueryParams : PaginationParams
    {
        /// <summary>When true, only unread items are returned (drives the bell badge).</summary>
        public bool? UnreadOnly { get; set; }
    }
}
