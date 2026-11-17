using System.ComponentModel.DataAnnotations;
using Shared.DataTransferObject.Recruitment;

namespace Shared.DataTransferObject.Separation
{
    // =====================================================================
    // Separations (api-spec-from-ui.md §5.6 — T1–T6 + the E19 offboard)
    // =====================================================================

    /// <summary>Final exit verdict (T5) — null until HR saves one.</summary>
    public class SeparationVerdict
    {
        public string? FinalReason { get; set; }
        public SeparationSettlement? Settlement { get; set; }
        public SeparationRehire? Rehire { get; set; }
    }

    /// <summary>Settlement direction vocabulary: none | owedToEmployee | employeeOwes.</summary>
    public class SeparationSettlement
    {
        public string Direction { get; set; } = "none";
        public decimal Amount { get; set; }
        public string? Note { get; set; }
    }

    /// <summary>Rehire verdict vocabulary: Eligible | Banned.</summary>
    public class SeparationRehire
    {
        public string Status { get; set; } = string.Empty;
        public string? Note { get; set; }
    }

    /// <summary>T1 list item / T1 detail — same shape.</summary>
    public class SeparationItem
    {
        public int Id { get; set; }
        public string? Employee { get; set; }
        public int? EmployeeId { get; set; }
        public string? Position { get; set; }
        public string? Gym { get; set; }
        public DateOnly LastDay { get; set; }
        public string? Reason { get; set; }
        public string? RequestedBy { get; set; }
        public string? RequestedByUser { get; set; }
        public DateTime SubmittedDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string SeparationType { get; set; } = string.Empty;

        /// <summary>Checklist completion percentage (0–100) — the mock's item shape.</summary>
        public int Progress { get; set; }

        public IReadOnlyList<ChecklistEntry> Checklist { get; set; } = [];
        public SeparationVerdict? Verdict { get; set; }
        public decimal? LeaveTaken { get; set; }
    }

    public class SeparationListQuery
    {
        /// <summary>"all" | gym id | branch name (§5.6 queue filter).</summary>
        [StringLength(100)]
        public string? Gym { get; init; }

        [StringLength(50)]
        public string? Status { get; init; }

        [StringLength(50)]
        public string? Type { get; init; }

        public int Page { get; init; } = 1;

        public int PageSize { get; init; } = 20;
    }

    public class SeparationListResponse
    {
        public IReadOnlyList<SeparationItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    public class SeparationDataResponse
    {
        public SeparationItem Data { get; set; } = new();
    }

    /// <summary>E19 offboard response payload: <c>{ separationId }</c>.</summary>
    public class OffboardResponse
    {
        public OffboardResponseData Data { get; set; } = new();
    }

    public class OffboardResponseData
    {
        public int SeparationId { get; set; }
    }

    /// <summary>T2 — Branch Manager termination request (reason is a closed vocabulary).</summary>
    public class CreateSeparationRequest
    {
        public int EmployeeId { get; init; }

        public DateOnly LastDay { get; init; }

        [Required, StringLength(200)]
        public string Reason { get; init; } = string.Empty;

        [StringLength(1000)]
        public string? Notes { get; init; }
    }

    /// <summary>E19 — POST /api/employees/{id}/offboard. Reason is free text; separationType defaults to Resignation.</summary>
    public class OffboardEmployeeRequest
    {
        public DateOnly LastDay { get; init; }

        [Required, StringLength(200)]
        public string Reason { get; init; } = string.Empty;

        [StringLength(1000)]
        public string? Notes { get; init; }

        /// <summary>"Resignation" | "Termination".</summary>
        [StringLength(30)]
        public string? SeparationType { get; init; }
    }

    /// <summary>T3 — one checklist row toggle.</summary>
    public class SeparationChecklistRequest
    {
        /// <summary>0-based index into the five exit tasks.</summary>
        public int Index { get; init; }

        public bool Done { get; init; }
    }

    /// <summary>T3 — PUT /api/separations/{id}/checklist → <c>{ data: { progress, status } }</c>.</summary>
    public class SeparationChecklistDataResponse
    {
        public SeparationChecklistResponse Data { get; set; } = new();
    }

    public class SeparationChecklistResponse
    {
        /// <summary>Completion percentage (0–100) after the toggle.</summary>
        public int Progress { get; set; }

        public string Status { get; set; } = string.Empty;
    }

    /// <summary>T4 — stage move. Vocabulary: Requested | Notice Period | Exit In Progress | Under Review | Completed.</summary>
    public class SeparationStageRequest
    {
        [Required, StringLength(50)]
        public string Status { get; init; } = string.Empty;
    }

    /// <summary>T5 — exit verdict (moves the case to Under Review).</summary>
    public class SeparationVerdictRequest
    {
        [Required, StringLength(1000)]
        public string FinalReason { get; init; } = string.Empty;

        [Required]
        public SeparationSettlementInput Settlement { get; init; } = new();

        [Required]
        public SeparationRehireInput Rehire { get; init; } = new();
    }

    public class SeparationSettlementInput
    {
        /// <summary>none | owedToEmployee | employeeOwes.</summary>
        [Required, StringLength(30)]
        public string Direction { get; init; } = string.Empty;

        [Range(typeof(decimal), "0", "100000000")]
        public decimal Amount { get; init; }

        [StringLength(1000)]
        public string? Note { get; init; }
    }

    public class SeparationRehireInput
    {
        /// <summary>Eligible | Banned.</summary>
        [Required, StringLength(30)]
        public string Status { get; init; } = string.Empty;

        [StringLength(1000)]
        public string? Note { get; init; }
    }
}
