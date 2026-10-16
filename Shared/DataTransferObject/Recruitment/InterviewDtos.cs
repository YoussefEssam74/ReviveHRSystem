namespace Shared.DataTransferObject.Recruitment
{
    /// <summary>GET /api/interviews query — month/date/status calendar filters.</summary>
    public class InterviewListQuery
    {
        /// <summary>YYYY-MM month window.</summary>
        public string? Month { get; set; }
        /// <summary>YYYY-MM-DD selected day.</summary>
        public string? Date { get; set; }
        /// <summary>all | pending | completed | cancelled.</summary>
        public string? Status { get; set; }
        public int? CandidateId { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 50;
        public string? SortBy { get; set; }
        public string? SortOrder { get; set; }
    }

    /// <summary>POST /api/interviews body — `candidateId` is preferred; the UI's "Name — Position" string is accepted too.</summary>
    public class CreateInterviewRequest
    {
        public int? CandidateId { get; set; }
        /// <summary>"Name — Position" select value from the mock; resolved when CandidateId is absent.</summary>
        public string? Candidate { get; set; }
        public string? Position { get; set; }
        public string? Date { get; set; }
        public string? Time { get; set; }
        /// <summary>On-site | Video | Trial | Panel.</summary>
        public string? Type { get; set; }
        public string? Interviewer { get; set; }
        public string? Room { get; set; }
    }

    /// <summary>One interview row of the Interviews tab.</summary>
    public class InterviewItem
    {
        public int Id { get; set; }
        public int? CandidateId { get; set; }
        public string Candidate { get; set; } = string.Empty;
        public string? Position { get; set; }
        public string? Gym { get; set; }
        public DateOnly Date { get; set; }
        /// <summary>HH:mm.</summary>
        public string Time { get; set; } = string.Empty;
        public DateTime ScheduledDate { get; set; }
        public string? Type { get; set; }
        public string? Interviewer { get; set; }
        /// <summary>Scheduled | Invited | Completed | Cancelled | Draft.</summary>
        public string Status { get; set; } = string.Empty;
        public string? Room { get; set; }
        public string? Verdict { get; set; }
        public string? Evaluation { get; set; }
    }

    public class InterviewDataResponse
    {
        public InterviewItem Data { get; set; } = null!;
    }

    public class InterviewListResponse
    {
        public IReadOnlyList<InterviewItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>POST /api/interviews/{id}/reminder response.</summary>
    public class ReminderResponse
    {
        public string Message { get; set; } = "Reminder sent.";
    }
}
