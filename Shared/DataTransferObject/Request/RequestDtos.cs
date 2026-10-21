namespace Shared.DataTransferObject.Request
{
    // ------------------------------------------------------------------
    // Requests module (S3 — Section 4 R1–R7 + A2/A6/A8): contracts for the
    // HR requests inbox. The list item mirrors the card fields the mock UI
    // renders (identity, decisions, payment, timeline), and the envelopes
    // follow the conventions used by the Employees (S1) and Roles (S2)
    // modules: paged {items,page,pageSize,total,totalPages}, single-item
    // {data:...}, and actions {message:...}.
    // ------------------------------------------------------------------

    /// <summary>
    /// Query for GET /api/requests (R1). Status accepts the display values the UI
    /// tabs send (Pending HR Review, Approved, Rejected, Archived) plus the pseudo
    /// value Decided; type filters by request type; date (A2) matches requests whose
    /// effective span covers that day; quick applies the KPI shortcuts
    /// (urgent | bmRejected | balance | approved).
    /// </summary>
    public class RequestListQuery
    {
        public string? Status { get; init; }
        public string? Type { get; init; }
        public int? Gym { get; init; }
        public string? Date { get; init; }
        public string? Quick { get; init; }
        /// <summary>Comma-separated ids (e.g. "12,15") — the payroll settlement sheet's linked requests.</summary>
        public string? Ids { get; init; }
        public int Page { get; init; } = 1;
        public int PageSize { get; init; } = 20;
        public string? SortBy { get; init; }
        public string? SortOrder { get; init; }
    }

    /// <summary>One timeline chip: step label, display date, and whether the step is done.</summary>
    public class RequestTimelineStep
    {
        public required string Step { get; init; }
        public required string Date { get; init; }
        public bool Done { get; init; }
    }

    /// <summary>One request card (R1/R2 item) — identity, decisions, payment, and timeline.</summary>
    public class RequestListItem
    {
        public int Id { get; init; }
        public required string Employee { get; init; }
        public required string Gym { get; init; }
        public required string Type { get; init; }
        public DateOnly SubmittedDate { get; init; }
        public DateOnly RequestedDate { get; init; }

        /// <summary>End of a leave/swap range (annual, sick, shift swap), null on single-day types.</summary>
        public DateOnly? EndDate { get; init; }
        public required string Status { get; init; }
        public string? BmDecision { get; init; }
        public string? BmComment { get; init; }
        public string? HrDecision { get; init; }
        public string? HrComment { get; init; }
        public string? Payment { get; init; }
        public string Reason { get; init; } = string.Empty;
        public List<RequestTimelineStep> Timeline { get; init; } = [];
    }

    /// <summary>Paged envelope for GET /api/requests.</summary>
    public class RequestListResponse
    {
        public List<RequestListItem> Items { get; init; } = [];
        public int Page { get; init; }
        public int PageSize { get; init; }
        public int Total { get; init; }
        public int TotalPages { get; init; }
    }

    /// <summary>GET /api/requests/{id} — { data: (item as R1) }.</summary>
    public class RequestDetailResponse
    {
        public required RequestListItem Data { get; init; }
    }

    /// <summary>
    /// POST /api/requests (R7) — HR creating a request on an employee's behalf.
    /// <c>Employee</c> is the full name the picker sends; dates are ISO yyyy-MM-dd.
    /// </summary>
    public class CreateRequestRequest
    {
        public string? Employee { get; init; }
        public string? Type { get; init; }
        public string? RequestedDate { get; init; }
        public string? EndDate { get; init; }
        public string? Reason { get; init; }
    }

    /// <summary>POST /api/requests response — { data: { id, status, timeline } }.</summary>
    public class CreateRequestResponse
    {
        public required CreatedRequestData Data { get; init; }
    }

    public class CreatedRequestData
    {
        public int Id { get; init; }
        public required string Status { get; init; }
        public List<RequestTimelineStep> Timeline { get; init; } = [];
    }

    /// <summary>
    /// POST /api/requests/{id}/decide (R3, also A6) — stage is "HR" for this portal;
    /// decision is Approved or Rejected (rejection requires a comment); payment
    /// ("paid" | "unpaid") only applies to Day Off / Sick Leave approvals.
    /// </summary>
    public class DecideRequestRequest
    {
        public string? Stage { get; init; }
        public string? Decision { get; init; }
        public string? Comment { get; init; }
        public string? Payment { get; init; }
    }

    /// <summary>
    /// Shared response for decide (R3) and undo-decision (R4): { message, item }.
    /// <c>OffboardingPrompt</c> is true when an approved resignation should offer the
    /// separation checklist (T10); <c>SeparationId</c> fills in once the S6
    /// terminations module creates the case.
    /// </summary>
    public class RequestDecisionResponse
    {
        public required string Message { get; init; }
        public required RequestListItem Item { get; init; }
        public bool? OffboardingPrompt { get; init; }
        public int? SeparationId { get; init; }
    }

    /// <summary>POST /api/requests/{id}/undo-decision (R4) — optional undo note.</summary>
    public class UndoDecisionRequest
    {
        public string? Comment { get; init; }
    }

    /// <summary>
    /// POST /api/requests/bulk-decide (R5) — approve pending requests in bulk.
    /// Null <c>RequestIds</c> means every Pending HR Review request in the caller's
    /// gym scope; payment is derived per balance (paid while days remain, else unpaid).
    /// </summary>
    public class BulkDecideRequest
    {
        public string? Decision { get; init; }
        public string? Comment { get; init; }
        public List<int>? RequestIds { get; init; }
    }

    /// <summary>R5 response — { message, approved, unpaidApplied }.</summary>
    public class BulkDecideResponse
    {
        public required string Message { get; init; }
        public int Approved { get; init; }
        public int UnpaidApplied { get; init; }
    }

    /// <summary>Employee file → Requests tab (A8): plain array with the BM comment the row renders.</summary>
    public class EmployeeRequestItem
    {
        public int Id { get; init; }
        public required string Type { get; init; }
        public DateOnly RequestedDate { get; init; }

        /// <summary>End of a leave/swap range, null on single-day types (A8 list).</summary>
        public DateOnly? EndDate { get; init; }

        public DateOnly SubmittedDate { get; init; }
        public required string Status { get; init; }
        public string Reason { get; init; } = string.Empty;
        public string? BmComment { get; init; }
    }
}
