namespace Shared.DataTransferObject.Recruitment
{
    // ------------------------------------------------------------------
    // Vacancies (api-spec-from-ui.md §5.1)
    // ------------------------------------------------------------------

    /// <summary>GET /api/vacancies query — list conventions from api.md.</summary>
    public class VacancyListQuery
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public string? SearchTerm { get; set; }
        /// <summary>Open | Draft | Closed (blank = all).</summary>
        public string? Status { get; set; }
        /// <summary>Gym id filter (blank = all gyms the actor can see).</summary>
        public int? Gym { get; set; }
        public string? SortBy { get; set; }
        public string? SortOrder { get; set; }
    }

    /// <summary>POST /api/vacancies body. `gym` (name) or `gymId` may be sent; one is required.</summary>
    public class CreateVacancyRequest
    {
        public string? Position { get; set; }
        public string? Gym { get; set; }
        public int? GymId { get; set; }
        public int HeadcountNeeded { get; set; } = 1;
        public string? Urgency { get; set; }
        public string? Source { get; set; }
        public string? JobDescription { get; set; }
        public string? Requirements { get; set; }
        public decimal? Salary { get; set; }
        public string? Shift { get; set; }
        /// <summary>Draft vacancies are saved unpublished.</summary>
        public string? Status { get; set; }
    }

    /// <summary>PUT /api/vacancies/{id} body — every field optional (partial update).</summary>
    public class UpdateVacancyRequest
    {
        public string? Position { get; set; }
        public string? Gym { get; set; }
        public int? GymId { get; set; }
        public int? HeadcountNeeded { get; set; }
        public string? Urgency { get; set; }
        public string? Source { get; set; }
        public string? JobDescription { get; set; }
        public string? Requirements { get; set; }
        public decimal? Salary { get; set; }
        public string? Shift { get; set; }
        public string? Status { get; set; }
    }

    /// <summary>One vacancy as the UI renders it (table row, summary card, action panel).</summary>
    public class VacancyItem
    {
        public int Id { get; set; }
        public int? PositionId { get; set; }
        public string Position { get; set; } = string.Empty;
        public int? GymId { get; set; }
        public string Gym { get; set; } = string.Empty;
        public int Headcount { get; set; }
        public string? Urgency { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public int Candidates { get; set; }
        public string? RequestedBy { get; set; }
        public decimal? Salary { get; set; }
        public string? Shift { get; set; }
        public string? Source { get; set; }
        public string? Description { get; set; }
        public string? Requirements { get; set; }
    }

    /// <summary>Funnel bar for the vacancy detail modal: `{ stage, count }`.</summary>
    public class VacancyFunnelStage
    {
        public string Stage { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    /// <summary>Employee currently under the vacancy's position: `{ id, name, initials, position, gym }`.</summary>
    public class VacancyEmployeeItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Initials { get; set; } = string.Empty;
        public string? Position { get; set; }
        public string? Gym { get; set; }
    }

    /// <summary>GET /api/vacancies/{id} — vacancy + funnel + employees + candidates under it.</summary>
    public class VacancyDetailResponse
    {
        public VacancyItem Data { get; set; } = null!;
        public IReadOnlyList<VacancyFunnelStage> Funnel { get; set; } = [];
        public IReadOnlyList<VacancyEmployeeItem> EmployeesUnderPosition { get; set; } = [];
        public IReadOnlyList<CandidateItem> Candidates { get; set; } = [];
    }

    public class VacancyDataResponse
    {
        public VacancyItem Data { get; set; } = null!;
    }

    public class VacancyListResponse
    {
        public IReadOnlyList<VacancyItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    // ------------------------------------------------------------------
    // Vacancy Requests (api-spec-from-ui.md §5.2)
    // ------------------------------------------------------------------

    /// <summary>GET /api/vacancy-requests query.</summary>
    public class VacancyRequestListQuery
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        /// <summary>Pending | Approved | Rejected (blank = all).</summary>
        public string? Status { get; set; }
        public int? Gym { get; set; }
    }

    /// <summary>POST /api/vacancy-requests body: `{ position, gym, urgency, reason, salary, shift, headcount }`.</summary>
    public class CreateVacancyRequestBody
    {
        public string? Position { get; set; }
        public string? Gym { get; set; }
        public int? GymId { get; set; }
        public string? Urgency { get; set; }
        public string? Reason { get; set; }
        public decimal? Salary { get; set; }
        public string? Shift { get; set; }
        public int Headcount { get; set; } = 1;
    }

    /// <summary>PUT /api/vacancy-requests/{id}/decide body — approve creates the resulting Vacancy.</summary>
    public class DecideVacancyRequestRequest
    {
        public string? Decision { get; set; }
        public string? Comment { get; set; }
        public int? PositionId { get; set; }
        public int? HeadcountNeeded { get; set; }
        public string? Urgency { get; set; }
        public decimal? Salary { get; set; }
        public string? Shift { get; set; }
        public string? JobDescription { get; set; }
    }

    /// <summary>One vacancy request card: position, gym, submittedBy/date, urgency, reason, status, decidedBy.</summary>
    public class VacancyRequestItem
    {
        public int Id { get; set; }
        public int? PositionId { get; set; }
        public string Position { get; set; } = string.Empty;
        public int? GymId { get; set; }
        public string Gym { get; set; } = string.Empty;
        public string? Urgency { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? SubmittedBy { get; set; }
        public DateTime SubmittedDate { get; set; }
        public string Reason { get; set; } = string.Empty;
        public decimal? Salary { get; set; }
        public string? Shift { get; set; }
        public int Headcount { get; set; }
        public string? DecidedBy { get; set; }
        /// <summary>Vacancy created by an approval (null until approved).</summary>
        public int? VacancyId { get; set; }
    }

    public class VacancyRequestDataResponse
    {
        public VacancyRequestItem Data { get; set; } = null!;
    }

    public class VacancyRequestListResponse
    {
        public IReadOnlyList<VacancyRequestItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>PUT /api/vacancy-requests/{id}/decide response: `{ id, status, decidedBy, vacancyId? }`.</summary>
    public class VacancyRequestDecisionResponse
    {
        public VacancyRequestItem Data { get; set; } = null!;
    }

    /// <summary>PUT /api/vacancy-requests/{id}/reopen response.</summary>
    public class ReopenVacancyRequestResponse
    {
        public int Id { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? DecidedBy { get; set; }
        /// <summary>True when the vacancy created by the approval had no applicants and was withdrawn.</summary>
        public bool VacancyWithdrawn { get; set; }
    }
}
