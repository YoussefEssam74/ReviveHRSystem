namespace Shared.DataTransferObject.Recruitment
{
    /// <summary>GET /api/candidates query — pipeline/table filters.</summary>
    public class CandidateListQuery
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public string? SearchTerm { get; set; }
        /// <summary>Applied | Screening | First Interview | Second Interview | Accepted | Rejected | Hired.</summary>
        public string? Stage { get; set; }
        public string? Position { get; set; }
        /// <summary>active (in-process, minus blocked) | rejected.</summary>
        public string? View { get; set; }
        public bool? Blocked { get; set; }
        public string? SortBy { get; set; }
        public string? SortOrder { get; set; }
    }

    /// <summary>The candidate's application form (`form` object on the UI).</summary>
    public class CandidateForm
    {
        public string? Email { get; set; }
        public string? Source { get; set; }
        public string? GymPref { get; set; }
        public int ExpYears { get; set; }
        public string? Education { get; set; }
        public IReadOnlyList<string> Skills { get; set; } = [];
        public IReadOnlyList<string> Languages { get; set; } = [];
        public string? Shift { get; set; }
        public decimal? SalaryExp { get; set; }
        public string? Availability { get; set; }
    }

    /// <summary>Screening or interview block: `{ date, by, verdict, eval, room?, type?, notes }`.</summary>
    public class CandidateStageBlock
    {
        public DateTime? Date { get; set; }
        public string? By { get; set; }
        public string? Verdict { get; set; }
        public string? Eval { get; set; }
        public string? Type { get; set; }
        public string? Room { get; set; }
        public string? Notes { get; set; }
    }

    /// <summary>Final decision block: `{ by, date, verdict, note }`.</summary>
    public class CandidateDecisionBlock
    {
        public string? By { get; set; }
        public DateTime? Date { get; set; }
        /// <summary>Accepted | Rejected.</summary>
        public string? Verdict { get; set; }
        public string? Note { get; set; }
    }

    /// <summary>One candidate as the kanban card / table row / detail modal renders it.</summary>
    public class CandidateItem
    {
        public int Id { get; set; }
        public int? ApplicationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Initials { get; set; } = string.Empty;
        public string? Position { get; set; }
        /// <summary>Current pipeline stage display string.</summary>
        public string Stage { get; set; } = string.Empty;
        public DateTime AppliedDate { get; set; }
        public string? Phone { get; set; }
        public decimal? Rating { get; set; }
        public bool Blocked { get; set; }
        public string? BlockReason { get; set; }
        public DateTime? HiredDate { get; set; }
        public DateTime? RejectedDate { get; set; }
        public string? RejectedBy { get; set; }
        public string? RejectReason { get; set; }
        public CandidateForm Form { get; set; } = new();
        public CandidateStageBlock? Screen { get; set; }
        public CandidateStageBlock? Iv1 { get; set; }
        public CandidateStageBlock? Iv2 { get; set; }
        public CandidateDecisionBlock? Decision { get; set; }
    }

    public class CandidateDataResponse
    {
        public CandidateItem Data { get; set; } = null!;
    }

    public class CandidateListResponse
    {
        public IReadOnlyList<CandidateItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>PUT /api/candidates/{id}/block body.</summary>
    public class BlockCandidateRequest
    {
        public bool Blocked { get; set; }
        public string? BlockReason { get; set; }
    }

    /// <summary>PUT /api/candidates/{id}/block response.</summary>
    public class CandidateBlockResponse
    {
        public int Id { get; set; }
        public bool Blocked { get; set; }
        public string? BlockReason { get; set; }
    }

    /// <summary>PUT /api/applications/{id}/stage body.</summary>
    public class ChangeApplicationStageRequest
    {
        public string? Stage { get; set; }
    }

    /// <summary>
    /// PUT /api/applications/{id}/stage response — when the application enters
    /// Second Interview without one, the server schedules the round and returns it.
    /// </summary>
    public class ApplicationStageResponse
    {
        public int Id { get; set; }
        public string Stage { get; set; } = string.Empty;
        public InterviewItem? Iv2 { get; set; }
    }
}
