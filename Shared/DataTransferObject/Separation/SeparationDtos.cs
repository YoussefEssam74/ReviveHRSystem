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

        /// <summary>Annual days earned in the exit calendar year (pro-rated).</summary>
        public decimal LeaveEarnedDaysThisYear { get; set; }

        /// <summary>Earned days never taken — the days encashed.</summary>
        public decimal LeaveEncashmentDays { get; set; }

        /// <summary>Base salary ÷ the exit month's calendar days.</summary>
        public decimal LeaveEncashmentDailyRate { get; set; }

        /// <summary>Encashment days × the daily rate (owed to the employee).</summary>
        public decimal LeaveEncashmentAmount { get; set; }

        /// <summary>Days taken beyond the earned balance, plus days settled unpaid.</summary>
        public decimal UnpaidLeaveDays { get; set; }

        /// <summary>Unpaid-leave days × the daily rate (owed by the employee).</summary>
        public decimal UnpaidLeaveAmount { get; set; }
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
        public string? EmployeeNumber { get; set; }
        public string? Position { get; set; }
        public string? Gym { get; set; }
        public DateOnly LastDay { get; set; }
        public DateOnly? HireDate { get; set; }
        public DateOnly? TerminationDate { get; set; }
        public string? Reason { get; set; }
        public string? Notes { get; set; }
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

        // ------------------------------------------------------------------
        // Termination workflow: HR approval → exit interview → clearance.
        // ------------------------------------------------------------------

        /// <summary>"Pending" | "Approved" | "Rejected".</summary>
        public string ApprovalStatus { get; set; } = "Approved";

        public string? ApprovedBy { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? ApprovalNote { get; set; }

        /// <summary>"Scheduled" | "Completed" | "No Show" | "Rescheduled" (null = not scheduled).</summary>
        public string? ExitInterviewStatus { get; set; }

        public DateTime? ExitInterviewScheduledAt { get; set; }
        public DateTime? ExitInterviewCompletedAt { get; set; }
        public ExitInterviewDetails? ExitInterview { get; set; }
        public SeparationClearance? Clearance { get; set; }
        public bool Blacklisted { get; set; }
        public string? BlacklistReason { get; set; }
    }

    /// <summary>The professional exit interview form saved by HR.</summary>
    public class ExitInterviewDetails
    {
        public string? Interviewer { get; set; }
        public DateOnly? InterviewDate { get; set; }
        public string? ReasonForLeaving { get; set; }
        public string? WhatLikedMost { get; set; }
        public string? WhatToImprove { get; set; }
        public int? JobSatisfaction { get; set; }
        public int? ManagementRating { get; set; }
        public int? WorkEnvironmentRating { get; set; }
        public int? CompensationRating { get; set; }
        public bool? WouldRecommend { get; set; }
        public string? Notes { get; set; }
        public bool? RehireEligible { get; set; }
        public string? RehireNote { get; set; }
        /// <summary>The interview's question set (editable labels/options) with the recorded answers.</summary>
        public List<ExitInterviewQuestion> Questions { get; set; } = [];
    }

    /// <summary>One exit-interview question and the answer HR recorded for it.</summary>
    public class ExitInterviewQuestion
    {
        /// <summary>Stable key; the seeded defaults reuse "reason"/"job"/"recommend"… for legacy sync.</summary>
        [StringLength(50)]
        public string Id { get; set; } = string.Empty;

        [StringLength(300)]
        public string Label { get; set; } = string.Empty;

        /// <summary>"text" | "select" | "checkbox" | "multi" | "rating".</summary>
        [StringLength(20)]
        public string Kind { get; set; } = "text";

        /// <summary>Answer choices for select/multi questions.</summary>
        public List<string> Options { get; set; } = [];

        [StringLength(2000)]
        public string? Answer { get; set; }
    }

    /// <summary>Clearance / final-settlement state of the exit.</summary>
    public class SeparationClearance
    {
        public bool UniformReturned { get; set; }
        public bool AssetsReturned { get; set; }
        public bool AccessRevoked { get; set; }
        public bool FinalSettlementCompleted { get; set; }
        public bool Completed { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string? Notes { get; set; }
        public string? SettlementDirection { get; set; }
        public decimal? SettlementAmount { get; set; }
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

    /// <summary>
    /// T5 preview — annual-leave encashment for one exit, computed but never stored.
    /// </summary>
    public class SeparationLeaveEncashmentDataResponse
    {
        public SeparationLeaveEncashment Data { get; set; } = new();
    }

    public class SeparationLeaveEncashment
    {
        public DateOnly LastWorkingDay { get; set; }

        /// <summary>Annual days already consumed this year.</summary>
        public decimal UsedDays { get; set; }

        /// <summary>Annual days the exit year earns (pro-rated to the calendar year, capped at 12).</summary>
        public decimal EarnedDaysThisYear { get; set; }

        /// <summary>Earned days never taken — the days paid out.</summary>
        public decimal UnusedDays { get; set; }

        /// <summary>Days taken beyond the earned balance, plus days settled unpaid.</summary>
        public decimal DeficitDays { get; set; }

        public decimal BaseSalary { get; set; }

        public decimal DailyRate { get; set; }

        public decimal EncashmentAmount { get; set; }

        public decimal DebtAmount { get; set; }

        /// <summary>True while the six-month qualifying period has not been served.</summary>
        public bool BelowQualifyingPeriod { get; set; }
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

        /// <summary>
        /// Optional HR override of the computed encashment. Null = price the unused
        /// annual days the calculator worked out.
        /// </summary>
        [Range(typeof(decimal), "0", "100000000")]
        public decimal? LeaveEncashmentAmount { get; init; }

        /// <summary>
        /// Optional HR override of the computed unpaid-leave debt. Null = keep the
        /// calculator's figure. Never netted against the encashment.
        /// </summary>
        [Range(typeof(decimal), "0", "100000000")]
        public decimal? UnpaidLeaveAmount { get; init; }
    }

    public class SeparationRehireInput
    {
        /// <summary>Eligible | Banned.</summary>
        [Required, StringLength(30)]
        public string Status { get; init; } = string.Empty;

        [StringLength(1000)]
        public string? Note { get; init; }
    }

    // =====================================================================
    // Termination workflow — HR approval → exit interview → clearance
    // =====================================================================

    /// <summary>PUT /api/separations/{id}/approval — HR decision on a termination request.</summary>
    public class SeparationApprovalRequest
    {
        /// <summary>Approved | Rejected.</summary>
        [Required, StringLength(30)]
        public string Decision { get; init; } = string.Empty;

        [StringLength(1000)]
        public string? Note { get; init; }
    }

    /// <summary>PUT /api/separations/{id}/exit-interview/schedule — HR books the interview slot.</summary>
    public class ExitInterviewScheduleRequest
    {
        public DateTime ScheduledAt { get; init; }

        [StringLength(1000)]
        public string? Note { get; init; }
    }

    /// <summary>PUT /api/separations/{id}/exit-interview/status — Completed | No Show | Rescheduled.</summary>
    public class ExitInterviewStatusRequest
    {
        [Required, StringLength(30)]
        public string Status { get; init; } = string.Empty;

        /// <summary>Required when the status is Rescheduled.</summary>
        public DateTime? RescheduledAt { get; init; }

        [StringLength(1000)]
        public string? Note { get; init; }
    }

    /// <summary>PUT /api/separations/{id}/exit-interview — the professional exit interview form.</summary>
    public class ExitInterviewFormRequest
    {
        [StringLength(200)]
        public string? Interviewer { get; init; }

        public DateOnly? InterviewDate { get; init; }

        [StringLength(1000)]
        public string? ReasonForLeaving { get; init; }

        [StringLength(2000)]
        public string? WhatLikedMost { get; init; }

        [StringLength(2000)]
        public string? WhatToImprove { get; init; }

        [Range(1, 5)]
        public int? JobSatisfaction { get; init; }

        [Range(1, 5)]
        public int? ManagementRating { get; init; }

        [Range(1, 5)]
        public int? WorkEnvironmentRating { get; init; }

        [Range(1, 5)]
        public int? CompensationRating { get; init; }

        public bool? WouldRecommend { get; init; }

        [StringLength(2000)]
        public string? Notes { get; init; }

        public bool? RehireEligible { get; init; }

        [StringLength(1000)]
        public string? RehireNote { get; init; }

        public bool Blacklisted { get; init; }

        [StringLength(1000)]
        public string? BlacklistReason { get; init; }

        /// <summary>Marks the exit interview Completed when true.</summary>
        public bool Complete { get; init; }

        /// <summary>
        /// Editable question set. When omitted the legacy fixed fields above are used;
        /// when present the answers also sync back to those fields for known ids.
        /// </summary>
        public List<ExitInterviewQuestion>? Questions { get; init; }
    }

    /// <summary>PUT /api/separations/{id}/clearance — asset/uniform returns and final settlement.</summary>
    public class SeparationClearanceRequest
    {
        public bool UniformReturned { get; init; }

        public bool AssetsReturned { get; init; }

        public bool AccessRevoked { get; init; }

        public bool FinalSettlementCompleted { get; init; }

        /// <summary>none | owedToEmployee | employeeOwes.</summary>
        [StringLength(30)]
        public string? SettlementDirection { get; init; }

        [Range(typeof(decimal), "0", "100000000")]
        public decimal? SettlementAmount { get; init; }

        [StringLength(1000)]
        public string? Notes { get; init; }

        /// <summary>
        /// Completes clearance. When the exit interview is already completed the
        /// employee is archived automatically and moves to Former Employees.
        /// </summary>
        public bool Complete { get; init; }
    }
}
