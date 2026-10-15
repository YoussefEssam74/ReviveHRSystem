using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Employee
{
    // =====================================================================
    // Escalated action requests (api-spec-from-ui.md §9.4 / D6–D8)
    // =====================================================================

    /// <summary>Query for GET /api/action-requests (status=Pending feeds the Escalated tab).</summary>
    public class ActionRequestListQuery
    {
        [StringLength(30)]
        public string? Status { get; init; }

        /// <summary>"Transfer" | "CompensationChange" | "RoleAssign" | "Offboard" | "BulkImport".</summary>
        [StringLength(50)]
        public string? ActionType { get; init; }

        /// <summary>"all" | gym id | branch name (§5.6 queue filter).</summary>
        [StringLength(100)]
        public string? Gym { get; init; }

        public int Page { get; init; } = 1;

        public int PageSize { get; init; } = 20;
    }

    /// <summary>
    /// The proposed change payload (JSONB on the row) — gym values are branch
    /// NAMES (the mock renders them directly: "Nasr City → Heliopolis"); approve
    /// resolves the destination name to a gym id server-side.
    /// </summary>
    public class ActionRequestProposedDetails
    {
        public string? FromGym { get; init; }
        public string? ToGym { get; init; }
        public DateOnly? EffectiveDate { get; init; }
        public decimal? CurrentSalary { get; init; }
        public decimal? NewSalary { get; init; }
        public string? SystemRole { get; init; }
        public DateOnly? LastDay { get; init; }
        public string? Reason { get; init; }
        public string? Source { get; init; }
    }

    public class ActionRequestItem
    {
        public int Id { get; set; }
        public int? EmployeeId { get; set; }
        public string? Employee { get; set; }
        public string? Position { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public ActionRequestProposedDetails ProposedDetails { get; set; } = new();
        public string? Justification { get; set; }
        public int? RequestedById { get; set; }
        public string? RequestedBy { get; set; }
        public string Status { get; set; } = "Pending";
        public DateTime SubmittedDate { get; set; }
        public int? ReviewedById { get; set; }
        public string? ReviewedBy { get; set; }
        public DateTime? ReviewedDate { get; set; }
        public string? ReviewComment { get; set; }
    }

    public class ActionRequestListResponse
    {
        public IReadOnlyList<ActionRequestItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>PUT /api/action-requests/{id}/reject — the comment is required (§9.4).</summary>
    public class ActionRequestRejectRequest
    {
        [Required, StringLength(1000)]
        public string Comment { get; init; } = string.Empty;
    }

    /// <summary>PUT /api/action-requests/{id}/approve | /reject — §9.4 envelope.</summary>
    public class ActionRequestDecisionResponse
    {
        public ActionRequestDecisionData Data { get; set; } = new();
    }

    public class ActionRequestDecisionData
    {
        public int Id { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? ReviewedBy { get; set; }
        public DateTime? ReviewedDate { get; set; }

        /// <summary>true when approve executed the proposed effect server-side.</summary>
        public bool Executed { get; set; }

        public string? ReviewComment { get; set; }
    }
}
