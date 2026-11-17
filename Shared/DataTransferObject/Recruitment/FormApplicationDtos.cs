using System.Text.Json;

namespace Shared.DataTransferObject.Recruitment
{
    /// <summary>One stored answer of a public application — [{ question, type, answer }]; answer is a string or a string[].</summary>
    public class FormApplicationAnswer
    {
        public string Question { get; set; } = string.Empty;
        public string Type { get; set; } = "text";
        /// <summary>A plain string (text/choose) or a string array (checkbox); null when the applicant skipped it.</summary>
        public JsonElement? Answer { get; set; }
    }

    /// <summary>The careers-page extras of a submission, stored as JSON on the row and transferred to the pipeline Application on convert.</summary>
    public class FormApplicationCareers
    {
        public string? Source { get; set; }
        public int? ExpYears { get; set; }
        public string? Education { get; set; }
        public List<string>? Skills { get; set; }
        public List<string>? Languages { get; set; }
        public string? Shift { get; set; }
        public decimal? SalaryExp { get; set; }
        public string? Availability { get; set; }
    }

    /// <summary>POST /api/applications — anonymous submission of a hiring form (api-spec-from-ui.md §5.2). The careers page posts the same body plus the extra fields.</summary>
    public class SubmitFormApplicationRequest
    {
        public int? FormId { get; set; }
        public string? Name { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        /// <summary>Preferred branch on the simple form.</summary>
        public string? Gym { get; set; }
        /// <summary>Preferred branch on the careers form (wins over Gym).</summary>
        public string? GymPref { get; set; }
        public string? Position { get; set; }
        public List<FormApplicationAnswer>? Answers { get; set; }

        // Careers-page fields (accepted and stored; echoed back after convert).
        public string? Source { get; set; }
        public int? ExpYears { get; set; }
        public string? Education { get; set; }
        public List<string>? Skills { get; set; }
        public List<string>? Languages { get; set; }
        public string? Shift { get; set; }
        public decimal? SalaryExp { get; set; }
        public string? Availability { get; set; }
    }

    public class SubmitFormApplicationResponse
    {
        public string Message { get; set; } = string.Empty;
    }

    /// <summary>Applicant card (the Hiring tab's applicant pane).</summary>
    public class FormApplicationItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Gym { get; set; }
        public int FormId { get; set; }
        public string FormName { get; set; } = string.Empty;
        public string? Position { get; set; }
        public DateTime AppliedDate { get; set; }
        public string Status { get; set; } = "New";
        public string? RejectComment { get; set; }
        public List<FormApplicationAnswer> Answers { get; set; } = [];
    }

    /// <summary>GET /api/applications query (formId / status / searchTerm).</summary>
    public class FormApplicationListQuery
    {
        public int? FormId { get; set; }
        /// <summary>New | In Review | Shortlisted | Rejected | Moved to Pipeline (blank = all).</summary>
        public string? Status { get; set; }
        public string? SearchTerm { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class FormApplicationListResponse
    {
        public List<FormApplicationItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    public class FormApplicationDetailResponse
    {
        public FormApplicationItem Data { get; set; } = null!;
    }

    public class RejectFormApplicationRequest
    {
        public string? Comment { get; set; }
    }

    public class IdStatusData
    {
        public int Id { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class RejectFormApplicationResponse
    {
        public IdStatusData Data { get; set; } = null!;
    }

    public class ConvertToCandidateRequest
    {
        public int? ApplicationId { get; set; }
    }

    /// <summary>POST /api/candidates — the "Add to Pipeline" conversion (§5.2).</summary>
    public class ConvertToCandidateResponse
    {
        public CandidateItem Data { get; set; } = null!;
        public string ApplicationStatus { get; set; } = "Moved to Pipeline";
    }
}
