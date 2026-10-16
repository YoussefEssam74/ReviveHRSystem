using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Events
{
    // =====================================================================
    // Events queue (api-spec-from-ui.md §5.6 — GET /api/events & friends)
    // =====================================================================

    /// <summary>
    /// Query for GET /api/events. <c>Gym</c> accepts <c>all</c> (default), a branch
    /// id, or a branch name; <c>Type</c> takes the mock's tab type words and accepts
    /// several comma-separated (<c>Document Expiry,Contract Expiry</c>); <c>Resolved</c>
    /// toggles the "View resolved (n)" state (default open only).
    /// </summary>
    public class EventListQuery
    {
        [StringLength(100)]
        public string? Gym { get; init; }

        [StringLength(200)]
        public string? Type { get; init; }

        public bool? Resolved { get; init; }

        /// <summary>D5's alias: "Open" (default) | "Resolved" — normalized with <c>Resolved</c>.</summary>
        [StringLength(20)]
        public string? Status { get; init; }

        [StringLength(20)]
        public string? Urgency { get; init; }

        public int Page { get; init; } = 1;

        public int PageSize { get; init; } = 20;
    }

    /// <summary>
    /// One queue card: common fields + the flat per-type payload keys the mock
    /// spreads onto the item (documents/contracts, requests, offboarding,
    /// transfers, vacancy requests, payroll).
    /// </summary>
    public class EventItem
    {
        public int Id { get; set; }

        /// <summary>The mock's tab type word ("Document Expiry", "PendingHRReview", …).</summary>
        public string Type { get; set; } = string.Empty;

        /// <summary>Tab id of the type (documents | requests | offboarding | transfers | vacancies | payroll).</summary>
        public string Tab { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;
        public DateTime? Date { get; set; }
        public string Urgency { get; set; } = "medium";
        public string? Branch { get; set; }
        public string? Detail { get; set; }

        /// <summary>Permission key governing this event (visibility + resolve/reopen/decide).</summary>
        public string Permission { get; set; } = string.Empty;

        public bool Resolved { get; set; }
        public DateTime? ResolvedOn { get; set; }
        public string? ResolvedBy { get; set; }

        // --- Document Expiry / Contract Expiry ---------------------------
        public string? Employee { get; set; }
        public int? EmployeeId { get; set; }
        public string? DocType { get; set; }
        public string? DocNo { get; set; }
        public DateOnly? ExpiresOn { get; set; }
        public bool? EditableByEmployee { get; set; }
        public string? RenewalPath { get; set; }

        // --- PendingHRReview (requests) ----------------------------------
        public int? RequestId { get; set; }
        public string? RequestType { get; set; }
        public DateOnly? ForDate { get; set; }
        public DateTime? SubmittedOn { get; set; }
        public string? Reason { get; set; }
        public string? BmDecision { get; set; }
        public string? BmComment { get; set; }

        // --- Resignation / Termination (separations) ---------------------
        public string? Position { get; set; }
        public DateOnly? LastDay { get; set; }
        public string? RequestedBy { get; set; }
        public int? SeparationId { get; set; }
        public int? ChecklistDone { get; set; }
        public int? ChecklistTotal { get; set; }

        // --- TransferRequest ---------------------------------------------
        public string? FromGym { get; set; }
        public string? ToGym { get; set; }
        public DateOnly? EffectiveDate { get; set; }
        public string? RaisedBy { get; set; }
        public string? Justification { get; set; }

        // --- PendingVacancyRequest ---------------------------------------
        public int? VacancyRequestId { get; set; }
        public string? Gym { get; set; }
        public int? Headcount { get; set; }
        public string? VrUrgency { get; set; }
        public string? SubmittedBy { get; set; }
        public string? VrReason { get; set; }

        // --- PayrollApproval ---------------------------------------------
        public int? PayrollPeriodId { get; set; }
        public string? Period { get; set; }
        public decimal? GrossTotal { get; set; }
        public decimal? NetTotal { get; set; }
        public DateTime? PreparedOn { get; set; }
        public int? PendingDeductions { get; set; }
    }

    /// <summary>
    /// Envelope for GET /api/events — standard pagination plus <c>hidden</c>, the
    /// "N items hidden by your permissions" count for the page header.
    /// </summary>
    public class EventListResponse
    {
        public IReadOnlyList<EventItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
        public int Hidden { get; set; }
    }

    /// <summary>PUT /api/events/{id}/resolve → <c>{ data: { id, resolved, resolvedOn, resolvedBy } }</c>.</summary>
    public class EventResolveDataResponse
    {
        public EventResolveResponse Data { get; set; } = new();
    }

    public class EventResolveResponse
    {
        public int Id { get; set; }
        public bool Resolved { get; set; }
        public DateTime? ResolvedOn { get; set; }
        public string? ResolvedBy { get; set; }
    }

    /// <summary>POST /api/events/{id}/renewal-request → <c>201 { data: { notificationId, message } }</c>.</summary>
    public class EventRenewalDataResponse
    {
        public EventRenewalResponse Data { get; set; } = new();
    }

    public class EventRenewalResponse
    {
        public int NotificationId { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    /// <summary>PUT /api/events/{id}/decide — transfer ticket (approve executes the move).</summary>
    public class EventDecideRequest
    {
        /// <summary>"approve" | "reject".</summary>
        [Required, StringLength(20)]
        public string Decision { get; init; } = string.Empty;

        [StringLength(1000)]
        public string? Comment { get; init; }
    }

    /// <summary>Employee reference returned after an approving decision.</summary>
    public class EventDecideEmployee
    {
        public int Id { get; set; }
        public string? Gym { get; set; }
    }

    /// <summary>PUT /api/events/{id}/decide → <c>{ data: { id, resolved…, employee? } }</c>.</summary>
    public class EventDecideDataResponse
    {
        public EventDecideResponse Data { get; set; } = new();
    }

    public class EventDecideResponse
    {
        public int Id { get; set; }
        public bool Resolved { get; set; }
        public DateTime? ResolvedOn { get; set; }
        public string? ResolvedBy { get; set; }
        public EventDecideEmployee? Employee { get; set; }
    }

    // ---------------------------------------------------------------------
    // GET /api/events/counts
    // ---------------------------------------------------------------------

    public class EventCountGroup
    {
        public int Open { get; set; }
        public int High { get; set; }
        public int Resolved { get; set; }
    }

    /// <summary>GET /api/events/counts → <c>{ data: { documents: {…}, …, escalations: { open } } }</c>.</summary>
    public class EventCountsDataResponse
    {
        public EventCountsResponse Data { get; set; } = new();
    }

    public class EventCountsResponse
    {
        public EventCountGroup Documents { get; set; } = new();
        public EventCountGroup Requests { get; set; } = new();
        public EventCountGroup Offboarding { get; set; } = new();
        public EventCountGroup Transfers { get; set; } = new();
        public EventCountGroup Vacancies { get; set; } = new();
        public EventCountGroup Payroll { get; set; } = new();
        public EventCountGroup Escalations { get; set; } = new();
    }
}
