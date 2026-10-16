namespace Shared.DataTransferObject.Evaluation
{
    // ------------------------------------------------------------------
    // Form builder (api-spec-from-ui.md §5.3) + Evaluations page (§5.4)
    // ------------------------------------------------------------------

    /// <summary>One question as the editor writes it: `{ type: "text"|"checkbox"|"choose", text, options[] }`.</summary>
    public class FormQuestionInput
    {
        /// <summary>text (rating, no options) | choose (single) | checkbox (multi).</summary>
        public string? Type { get; set; }
        public string? Text { get; set; }
        public List<string>? Options { get; set; }
    }

    /// <summary>Stored question echo (same shape as the input).</summary>
    public class FormQuestionItem
    {
        public string Type { get; set; } = "text";
        public string Text { get; set; } = string.Empty;
        public List<string> Options { get; set; } = [];
    }

    /// <summary>POST/PUT /api/evaluation-forms body (the form-builder editor draft).</summary>
    public class UpsertEvaluationFormRequest
    {
        public string? Name { get; set; }
        /// <summary>Target Role/Position (Trainer | Receptionist | Cleaner | Maintenance | Branch Manager | All).</summary>
        public string? Position { get; set; }
        /// <summary>Alias of <see cref="Position"/> (the draft's `target` field).</summary>
        public string? Target { get; set; }
        /// <summary>Gym branch name, or "All" for every branch.</summary>
        public string? Gym { get; set; }
        public int? GymId { get; set; }
        /// <summary>Active | Completed | Inactive (defaults to Active).</summary>
        public string? Status { get; set; }
        public List<FormQuestionInput>? QuestionList { get; set; }
    }

    /// <summary>One form card: `{ id, name, position, target, gym, status, questions, questionList, createdDate, lastUsed, submissions }`.</summary>
    public class EvaluationFormItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        /// <summary>Target role title ("Trainer", …, "All").</summary>
        public string Position { get; set; } = "All";
        public string? Target { get; set; }
        /// <summary>Branch name, or "All".</summary>
        public string Gym { get; set; } = "All";
        /// <summary>Active | Completed | Inactive.</summary>
        public string Status { get; set; } = "Active";
        public int Questions { get; set; }
        public List<FormQuestionItem> QuestionList { get; set; } = [];
        public DateTime CreatedDate { get; set; }
        public DateTime? LastUsed { get; set; }
        /// <summary>Submitted responses through this form.</summary>
        public int Submissions { get; set; }
    }

    public class EvaluationFormResponse
    {
        public EvaluationFormItem Data { get; set; } = null!;
    }

    /// <summary>GET /api/evaluation-forms query.</summary>
    public class EvaluationFormListQuery
    {
        /// <summary>Active | Completed | Inactive (blank = all).</summary>
        public string? Status { get; set; }
        public int? Gym { get; set; }
        /// <summary>Target-role filter (blank = all).</summary>
        public string? Position { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class EvaluationFormListResponse
    {
        public List<EvaluationFormItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    // ------------------------------------------------------------------
    // Hiring forms (admin side of §5.3; public GETs live in §5.2)
    // ------------------------------------------------------------------

    /// <summary>POST/PUT /api/hiring-forms body.</summary>
    public class UpsertHiringFormRequest
    {
        public string? Name { get; set; }
        /// <summary>Target position title; null/blank = any.</summary>
        public string? Position { get; set; }
        /// <summary>Gym branch name, or "All" for every branch.</summary>
        public string? Gym { get; set; }
        public int? GymId { get; set; }
        /// <summary>Open (accepting submissions) | Closed.</summary>
        public string? Status { get; set; }
        public List<FormQuestionInput>? QuestionList { get; set; }
    }

    /// <summary>Hiring form card: `{ id, name, position, gym, status, questions, questionList, createdDate, lastUsed, applicants }`.</summary>
    public class HiringFormItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Position { get; set; }
        public string Gym { get; set; } = "All";
        /// <summary>Open | Closed.</summary>
        public string Status { get; set; } = "Open";
        public int Questions { get; set; }
        public List<FormQuestionItem> QuestionList { get; set; } = [];
        public DateTime CreatedDate { get; set; }
        public DateTime? LastUsed { get; set; }
        /// <summary>Form submissions received.</summary>
        public int Applicants { get; set; }
    }

    public class HiringFormResponse
    {
        public HiringFormItem Data { get; set; } = null!;
    }

    /// <summary>GET /api/hiring-forms query (the Hiring tab's card list; the public careers view passes gym as a name or id).</summary>
    public class HiringFormListQuery
    {
        /// <summary>Open | Closed (blank = all — the public view forces Open).</summary>
        public string? Status { get; set; }
        /// <summary>Gym id or branch name (blank = any).</summary>
        public string? Gym { get; set; }
        public string? Position { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class HiringFormListResponse
    {
        public List<HiringFormItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    // ------------------------------------------------------------------
    // §5.4 — dispatch + assignments + submissions + history
    // ------------------------------------------------------------------

    /// <summary>One (form, evaluator) assignment card: `{ id, formId, formName, evaluatorEmail, evaluatorName, subjects[], completedSubjects[], status, dispatchedDate, dispatchedBy }`.</summary>
    public class AssignmentItem
    {
        /// <summary>Group id = the lowest assignment-row id for (form, evaluator).</summary>
        public int Id { get; set; }
        public int FormId { get; set; }
        public string FormName { get; set; } = string.Empty;
        public string EvaluatorEmail { get; set; } = string.Empty;
        public string EvaluatorName { get; set; } = string.Empty;
        /// <summary>Subject employee names (chips).</summary>
        public List<string> Subjects { get; set; } = [];
        /// <summary>Subjects whose assignment row is Completed.</summary>
        public List<string> CompletedSubjects { get; set; } = [];
        /// <summary>Assigned | Completed (all subjects done).</summary>
        public string Status { get; set; } = "Assigned";
        public DateTime DispatchedDate { get; set; }
        public string DispatchedBy { get; set; } = string.Empty;
    }

    /// <summary>POST /api/evaluation-forms/{id}/dispatch → `{ data: { formId, createdAssignments[], routedEvaluators, evaluationsAssigned } }`.</summary>
    public class DispatchData
    {
        public int FormId { get; set; }
        public List<AssignmentItem> CreatedAssignments { get; set; } = [];
        public int RoutedEvaluators { get; set; }
        public int EvaluationsAssigned { get; set; }
    }

    public class DispatchResponse
    {
        public DispatchData Data { get; set; } = null!;
    }

    /// <summary>GET /api/evaluation-assignments query (the signed-in evaluator's inbox).</summary>
    public class AssignmentListQuery
    {
        public int? FormId { get; set; }
        /// <summary>Assigned | Completed (blank = all).</summary>
        public string? Status { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class AssignmentListResponse
    {
        public List<AssignmentItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>POST /api/evaluation-forms/{id}/responses body (free-run + assigned modes).</summary>
    public class SubmitEvaluationRequest
    {
        /// <summary>Employee display name (or send <c>employeeId</c>).</summary>
        public string? Employee { get; set; }
        public int? EmployeeId { get; set; }
        public int? FormId { get; set; }
        public string? Form { get; set; }
        public string? Period { get; set; }
        /// <summary>Computed percent (totalPoints / (questions × 5) × 100).</summary>
        public decimal? Score { get; set; }
        public string? Notes { get; set; }
        public List<SubmittedAnswer>? Answers { get; set; }
        /// <summary>Any assignment id of the evaluator's group for this form (assigned mode).</summary>
        public int? AssignmentId { get; set; }
    }

    public class SubmittedAnswer
    {
        public string? Question { get; set; }
        public string? Type { get; set; }
        public string? Answer { get; set; }
    }

    /// <summary>Submitted response echo: `{ id, employee, form, formId, period, score, status, notes, reviewedBy, reviewedDate, answers, gym }`.</summary>
    public class EvaluationResponseItem
    {
        public int Id { get; set; }
        public string Employee { get; set; } = string.Empty;
        public string Form { get; set; } = string.Empty;
        public int FormId { get; set; }
        public string? Period { get; set; }
        public decimal? Score { get; set; }
        /// <summary>Completed | In Progress.</summary>
        public string Status { get; set; } = "Completed";
        public string? Notes { get; set; }
        public string ReviewedBy { get; set; } = string.Empty;
        public DateTime ReviewedDate { get; set; }
        public List<EvaluationAnswerItem> Answers { get; set; } = [];
        public string Gym { get; set; } = string.Empty;
    }

    public class EvaluationAnswerItem
    {
        public string Question { get; set; } = string.Empty;
        public string Type { get; set; } = "text";
        public string Answer { get; set; } = string.Empty;
    }

    /// <summary>Assignment progress echoed back with a submission: `{ id, completedSubjects[], status }`.</summary>
    public class AssignmentEcho
    {
        public int Id { get; set; }
        public List<string> CompletedSubjects { get; set; } = [];
        public string Status { get; set; } = "Assigned";
    }

    public class SubmitEvaluationResponse
    {
        public EvaluationResponseItem Data { get; set; } = null!;
        /// <summary>Present only when the submission completed an assigned subject.</summary>
        public AssignmentEcho? Assignment { get; set; }
    }

    /// <summary>POST /api/evaluation-forms/{id}/launch-cycle body.</summary>
    public class LaunchCycleRequest
    {
        /// <summary>Review window label ("Q3 2026", "Probation Review", …).</summary>
        public string? Period { get; set; }
    }

    /// <summary>Launch-cycle → `{ data: { batchId, startedCount, status: "In Progress" } }` (batchId = the seeded cycle row).</summary>
    public class LaunchCycleData
    {
        public int BatchId { get; set; }
        public int StartedCount { get; set; }
        public string Status { get; set; } = "In Progress";
    }

    public class LaunchCycleResponse
    {
        public LaunchCycleData Data { get; set; } = null!;
    }

    /// <summary>GET /api/evaluation-responses · GET /api/evaluation-forms/{id}/responses query.</summary>
    public class EvaluationResponseListQuery
    {
        public int? EmployeeId { get; set; }
        public int? FormId { get; set; }
        public string? Period { get; set; }
        /// <summary>Completed | In Progress (blank = all).</summary>
        public string? Status { get; set; }
        public int? Gym { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class EvaluationResponseListResponse
    {
        public List<EvaluationResponseItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>Employee profile Evaluations tab row: `{ id, employee, position, period, score, result, status, gym, form, formId }`.</summary>
    public class EmployeeEvaluationItem
    {
        public int Id { get; set; }
        public string Employee { get; set; } = string.Empty;
        public string Position { get; set; } = string.Empty;
        public string? Period { get; set; }
        public decimal? Score { get; set; }
        /// <summary>Derived: ≥ 60 → "Pass", below → "Below Target".</summary>
        public string Result { get; set; } = string.Empty;
        /// <summary>Completed | In Progress.</summary>
        public string Status { get; set; } = "Completed";
        public string Gym { get; set; } = string.Empty;
        public string Form { get; set; } = string.Empty;
        public int FormId { get; set; }
    }

    public class EmployeeEvaluationResponse
    {
        public List<EmployeeEvaluationItem> Items { get; set; } = [];
    }

    // ------------------------------------------------------------------
    // Performance cycles + goals
    // ------------------------------------------------------------------

    /// <summary>One cycle chip: `{ id, name, start, end, status }`.</summary>
    public class PerformanceCycleItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public DateOnly Start { get; set; }
        public DateOnly End { get; set; }
        /// <summary>Upcoming | In Progress | Completed.</summary>
        public string Status { get; set; } = "Upcoming";
    }

    public class PerformanceCycleResponse
    {
        public List<PerformanceCycleItem> Items { get; set; } = [];
    }

    /// <summary>One goal card: `{ id, employee, title, status, progress, due, owner }`.</summary>
    public class GoalItem
    {
        public int Id { get; set; }
        public string Employee { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        /// <summary>On Track | At Risk | Behind.</summary>
        public string Status { get; set; } = "On Track";
        public int Progress { get; set; }
        public DateOnly? Due { get; set; }
        public string Owner { get; set; } = string.Empty;
    }

    public class GoalListResponse
    {
        public List<GoalItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>GET /api/goals query.</summary>
    public class GoalListQuery
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    /// <summary>POST /api/goals body (the + Add form).</summary>
    public class CreateGoalRequest
    {
        /// <summary>Employee display name (kept even when it matches nobody).</summary>
        public string? Employee { get; set; }
        public string? Title { get; set; }
        /// <summary>yyyy-MM-dd.</summary>
        public string? Due { get; set; }
        public string? Owner { get; set; }
    }

    public class GoalResponse
    {
        public GoalItem Data { get; set; } = null!;
    }
}
