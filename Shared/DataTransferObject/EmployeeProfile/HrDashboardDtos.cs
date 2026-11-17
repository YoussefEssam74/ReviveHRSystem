namespace Shared.DataTransferObject.EmployeeProfile
{
    // ------------------------------------------------------------------
    // GET /api/dashboard/hr — HR portal dashboard (mock §1 HR variant)
    // ------------------------------------------------------------------

    /// <summary>KPI strip: gym branches, total staff, pending requests, actions needed.</summary>
    public sealed class HrDashboardKpisDto
    {
        public int TotalGyms { get; init; }
        public int TotalStaff { get; init; }
        public int TotalPendingRequests { get; init; }
        public int ActionsNeeded { get; init; }
    }

    /// <summary>
    /// One decision card from the Actions Needed column: pending requests,
    /// vacancy approvals, branch-queue proposals, expiring contracts and
    /// payroll periods, each gated by the viewer's permissions.
    /// </summary>
    public sealed class HrDashboardActionDto
    {
        /// <summary>Stable identity ("request-12", "vacancy-3") for the client-side resolve links.</summary>
        public required string Id { get; init; }
        /// <summary>request | vacancy | deduction | warning | bonus | contract | payroll.</summary>
        public required string Kind { get; init; }
        public required string Badge { get; init; }
        public required string BadgeClass { get; init; }
        public required string Title { get; init; }
        public required string Subtitle { get; init; }
        public required string Detail { get; init; }
        /// <summary>Numeric id of the underlying row (the id inside <see cref="Id"/>).</summary>
        public int RefId { get; init; }
        /// <summary>Employee the card is about, when there is one (contracts, requests, branch proposals).</summary>
        public int? EmployeeId { get; init; }
        /// <summary>Date the card is anchored to (submitted/requested/issued/expires).</summary>
        public DateTime Date { get; init; }
        public int? GymId { get; init; }
        public string? Gym { get; init; }
    }

    /// <summary>One row of the Branches Oversight panel: headcount + pending action summary.</summary>
    public sealed class HrDashboardBranchDto
    {
        public int GymId { get; init; }
        public required string Name { get; init; }
        public string? Location { get; init; }
        public int Headcount { get; init; }
        public int PendingActions { get; init; }
        /// <summary>Human summary, e.g. "2 requests · 1 bonus".</summary>
        public string? Summary { get; init; }
    }

    /// <summary>Full HR dashboard payload: { kpis, actions, branches }.</summary>
    public sealed class HrDashboardDto
    {
        public string? Greeting { get; init; }
        public string? UserName { get; init; }
        public required HrDashboardKpisDto Kpis { get; init; }
        public required IReadOnlyList<HrDashboardActionDto> Actions { get; init; }
        public required IReadOnlyList<HrDashboardBranchDto> Branches { get; init; }
    }
}
