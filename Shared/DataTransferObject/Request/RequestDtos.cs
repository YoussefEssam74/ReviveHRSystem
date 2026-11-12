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

    /// <summary>
    /// Leave-balance snapshot the balance-type cards render (R1 "Balance" row,
    /// the decide modal's strip/warning, and the New Request live preview).
    /// </summary>
    public class RequestLeaveBalance
    {
        /// <summary>"Day-off balance" | "Sick leave balance".</summary>
        public required string Label { get; init; }
        public int Total { get; init; }
        public int Used { get; init; }
        /// <summary>Days still available today (never negative).</summary>
        public int Left { get; init; }
        /// <summary>Days left if this request is approved (equals <see cref="Left"/> once decided).</summary>
        public int AfterApproval { get; init; }
    }

    /// <summary>One request card (R1/R2 item) — identity, decisions, payment, and timeline.</summary>
    public class RequestListItem
    {
        public int Id { get; init; }
        public required string Employee { get; init; }
        public required string Gym { get; init; }
        public required string Type { get; init; }

        // ---- identity row (avatar/initials, position · level · gym · tenure) ----
        public int EmployeeId { get; init; }
        public string EmployeeNumber { get; init; } = string.Empty;
        public string Initials { get; init; } = string.Empty;
        public required string Position { get; init; }
        public string? Level { get; init; }
        public DateOnly? HireDate { get; init; }

        /// <summary>Populated for Day Off / Sick Leave only; null for every other type.</summary>
        public RequestLeaveBalance? LeaveBalance { get; init; }

        /// <summary>
        /// True while the request still sits at stage 1 (no branch-manager decision).
        /// HR may decide it directly when no manager is assigned to the gym; the
        /// decision records a "manager stage skipped" step in the timeline.
        /// </summary>
        public bool AwaitingManager { get; init; }
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

        /// <summary>A file (the sick-leave medical certificate) rides with this request.</summary>
        public bool HasAttachment { get; init; }

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

    /// <summary>One type-pill count on the inbox (R10).</summary>
    public class RequestTypeCount
    {
        public required string Type { get; init; }
        public int Count { get; init; }
    }

    /// <summary>
    /// GET /api/requests/summary (R10) — the counts the HR inbox prints without
    /// paging: the four KPI tiles, the three tab badges, and the type pills.
    /// </summary>
    public class RequestSummaryResponse
    {
        /// <summary>Pending HR Review requests plus stage-1 requests still awaiting a manager.</summary>
        public int Pending { get; init; }

        /// <summary>The subset of <see cref="Pending"/> that has no branch-manager decision yet.</summary>
        public int AwaitingManager { get; init; }

        /// <summary>Pending HR Review requests of a time-critical type (Late Arrival / Leave Early / Sick Leave).</summary>
        public int Urgent { get; init; }

        /// <summary>Approved requests whose requested date falls in the current month.</summary>
        public int ApprovedThisMonth { get; init; }

        /// <summary>Requests carrying a Branch Manager rejection (the "Review" queue).</summary>
        public int BmRejected { get; init; }

        /// <summary>Pending Day Off / Sick Leave requests with no balance left — HR must pick paid vs unpaid.</summary>
        public int BalanceAlerts { get; init; }

        /// <summary>Approved or Rejected (the "Decided" tab).</summary>
        public int Decided { get; init; }

        public int Archived { get; init; }

        /// <summary>Every request in scope (the "All" pill).</summary>
        public int Total { get; init; }

        public List<RequestTypeCount> ByType { get; init; } = [];
    }
}
