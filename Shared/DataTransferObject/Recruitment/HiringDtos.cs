namespace Shared.DataTransferObject.Recruitment
{
    // ------------------------------------------------------------------
    // Hire wizard / waiting-list assign (api-spec-from-ui.md §5.7, §5.1.5)
    // ------------------------------------------------------------------

    /// <summary>Shared offer terms of the hire wizard and the waiting-list assign wizard.</summary>
    public class HireTermsRequest
    {
        /// <summary>Target gym — `gym` (name) or `gymId` may be sent; one is required.</summary>
        public string? Gym { get; set; }
        public int? GymId { get; set; }
        public string? OfferLetterNote { get; set; }
        public decimal? Salary { get; set; }
        public decimal? AnnualIncrease { get; set; }
        public int? LeaveDays { get; set; }
        public string? StartDate { get; set; }
        /// <summary>Full-time | Part-time.</summary>
        public string? ContractType { get; set; }
        /// <summary>Junior | Mid | Senior.</summary>
        public string? Level { get; set; }
        public string? Email { get; set; }
        public string? Password { get; set; }
        /// <summary>System role name to assign (blank = none).</summary>
        public string? Role { get; set; }
    }

    /// <summary>POST /api/applications/{id}/hire body (offer terms + optional vacancy linkage).</summary>
    public class HireApplicationRequest : HireTermsRequest
    {
        public int? VacancyId { get; set; }
    }

    /// <summary>
    /// POST /api/applications/{id}/hire response — creates the employee profile
    /// (application + interview data carried), sets the candidate to Hired, decrements
    /// the vacancy headcount, starts the onboarding checklist, and audit-logs the hire.
    /// </summary>
    public class HireResponse
    {
        public int EmployeeId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Position { get; set; }
        public string? Level { get; set; }
        public string? Gym { get; set; }
        public string Status { get; set; } = "Active";
        public string? StartDate { get; set; }
        public string? Email { get; set; }
        public decimal? Salary { get; set; }
        public int? LeaveDays { get; set; }
        public string? Role { get; set; }
        /// <summary>New-comers tab id — the created employee.</summary>
        public int NewComerId { get; set; }
        public DateTime? HiredDate { get; set; }
        public int VacancyHeadcountRemaining { get; set; }
    }

    public class HireDataResponse
    {
        public HireResponse Data { get; set; } = null!;
    }

    // ------------------------------------------------------------------
    // Waiting list (api-spec-from-ui.md §5.1.5)
    // ------------------------------------------------------------------

    /// <summary>GET /api/recruitment/waiting-list query.</summary>
    public class WaitingListQuery
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public string? Position { get; set; }
    }

    /// <summary>Open vacancy matched to a waiting candidate (partial position match).</summary>
    public class WaitingMatchItem
    {
        public int Id { get; set; }
        public string Position { get; set; } = string.Empty;
        public string? Gym { get; set; }
        public int Headcount { get; set; }
        public string? Urgency { get; set; }
        public int Candidates { get; set; }
    }

    /// <summary>One waiting-list card: name, position, days waiting, skills, note, source, matches.</summary>
    public class WaitingListItem
    {
        public int Id { get; set; }
        public int? CandidateId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Position { get; set; }
        public IReadOnlyList<string> Skills { get; set; } = [];
        public string? Note { get; set; }
        public DateTime Since { get; set; }
        public string? Source { get; set; }
        public IReadOnlyList<WaitingMatchItem> MatchingVacancies { get; set; } = [];
    }

    public class WaitingListResponse
    {
        public IReadOnlyList<WaitingListItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>POST /api/recruitment/waiting-list/{id}/assign body — the 3-step wizard's fields.</summary>
    public class AssignWaitingRequest
    {
        public int? VacancyId { get; set; }
        public string? Position { get; set; }
        public string? Gym { get; set; }
        public int? GymId { get; set; }
        public string? StartDate { get; set; }
        public decimal? Salary { get; set; }
        public decimal? AnnualIncrease { get; set; }
        public int? LeaveDays { get; set; }
        /// <summary>Junior | Mid | Senior.</summary>
        public string? Level { get; set; }
        public string? Email { get; set; }
        public string? Password { get; set; }
        public string? Role { get; set; }
    }

    /// <summary>POST /api/recruitment/waiting-list/{id}/assign response.</summary>
    public class AssignWaitingResponse
    {
        public int EmployeeId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Position { get; set; }
        public string? Level { get; set; }
        public string? Gym { get; set; }
        public string? StartDate { get; set; }
        public bool WaitingListRemoved { get; set; }
        public int NewComerId { get; set; }
    }

    public class AssignWaitingDataResponse
    {
        public AssignWaitingResponse Data { get; set; } = null!;
    }

    // ------------------------------------------------------------------
    // New Comers + onboarding checklist (api-spec-from-ui.md §5.1.6)
    // ------------------------------------------------------------------

    /// <summary>One New Comers tab card: initials/name, position, start date, progress, checklist tuples.</summary>
    public class NewComerItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Initials { get; set; } = string.Empty;
        public string? Position { get; set; }
        public string? StartDate { get; set; }
        /// <summary>0–100.</summary>
        public int Progress { get; set; }
        /// <summary>`[["ID & contract signed", false], …]` — label/done pairs as the UI renders them.</summary>
        public IReadOnlyList<ChecklistEntry> Checklist { get; set; } = [];
    }

    public class NewComerListResponse
    {
        public IReadOnlyList<NewComerItem> Items { get; set; } = [];
    }

    /// <summary>PUT /api/employees/{id}/onboarding-checklist body — single toggle or batch replace.</summary>
    public class OnboardingChecklistRequest
    {
        /// <summary>Checklist item label to toggle (single-item mode).</summary>
        public string? Item { get; set; }
        public bool? Done { get; set; }
        /// <summary>Batch mode: full `[label, done]` list.</summary>
        public IReadOnlyList<ChecklistEntry>? Checklist { get; set; }
    }

    /// <summary>PUT /api/employees/{id}/onboarding-checklist response.</summary>
    public class OnboardingChecklistResponse
    {
        public OnboardingChecklistData Data { get; set; } = null!;
    }

    public class OnboardingChecklistData
    {
        public int Id { get; set; }
        public int Progress { get; set; }
        public IReadOnlyList<ChecklistEntry> Checklist { get; set; } = [];
    }
}
