namespace Shared.DataTransferObject.Notification
{
    // ------------------------------------------------------------------
    // Notifications & Announcements (api-spec-from-ui.md §5.7)
    // ------------------------------------------------------------------

    /// <summary>GET /api/notifications query.</summary>
    public class NotificationListQuery
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        /// <summary>true = only unread.</summary>
        public bool? Unread { get; set; }
        /// <summary>Requests | Recruitment | Document | System | Announcements (blank = all).</summary>
        public string? Category { get; set; }
    }

    /// <summary>One notification row: `{ id, category, title, description, date, read, color, link }`.</summary>
    public class NotificationItem
    {
        public int Id { get; set; }
        public string Category { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public bool Read { get; set; }
        /// <summary>yellow | green | blue | red | purple (badge tone per category).</summary>
        public string Color { get; set; } = "blue";
        /// <summary>Page id the "Open →" action navigates to.</summary>
        public string? Link { get; set; }
    }

    public class NotificationListResponse
    {
        public IReadOnlyList<NotificationItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>GET /api/notifications/unread-count → `{ count }`.</summary>
    public class UnreadCountResponse
    {
        public int Count { get; set; }
    }

    /// <summary>GET /api/announcements query.</summary>
    public class AnnouncementListQuery
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        /// <summary>Gym id filter (blank = all in scope).</summary>
        public int? Gym { get; set; }
        /// <summary>Draft | Scheduled | Sent | Cancelled (blank = all).</summary>
        public string? Status { get; set; }
    }

    /// <summary>One announcement card: `{ id, title, audience, sentDate, status, readRate }`.</summary>
    public class AnnouncementItem
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        /// <summary>"All Employees" | branch name | "Trainers only" — the audience label as sent.</summary>
        public string Audience { get; set; } = string.Empty;
        public string? Type { get; set; }
        public DateTime? SentDate { get; set; }
        public string Status { get; set; } = "Sent";
        /// <summary>Percent 0–100 of targeted users who read it.</summary>
        public decimal ReadRate { get; set; }
        public string? Message { get; set; }
    }

    public class AnnouncementListResponse
    {
        public IReadOnlyList<AnnouncementItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>POST /api/announcements body (compose modal).</summary>
    public class CreateAnnouncementRequest
    {
        public string? Title { get; set; }
        /// <summary>"All Employees" | branch name | "Trainers only".</summary>
        public string? Audience { get; set; }
        /// <summary>Policy Update | Event | Reminder | Recognition.</summary>
        public string? Type { get; set; }
        public string? Message { get; set; }
    }

    /// <summary>PUT /api/announcements/{id} body — partial update (edit/retract).</summary>
    public class UpdateAnnouncementRequest
    {
        public string? Title { get; set; }
        public string? Audience { get; set; }
        public string? Type { get; set; }
        public string? Message { get; set; }
        /// <summary>Sent | Cancelled (retract flips to Cancelled).</summary>
        public string? Status { get; set; }
    }

    public class AnnouncementDataResponse
    {
        public AnnouncementItem Data { get; set; } = null!;
    }

    public class MessageDataResponse
    {
        public string Message { get; set; } = string.Empty;
    }
}
