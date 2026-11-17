using Shared.DataTransferObject.Evaluation;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Evaluations + form builder (api-spec-from-ui.md §5.3/§5.4): the dynamic-form
    /// CRUD for both kinds (evaluation | hiring), evaluator dispatch and the
    /// signed-in evaluator's assignment inbox, free-run &amp; assigned response
    /// submission, cycle launching, the org-wide history reads, and the
    /// performance-cycles/goals lists. Reads resolve the actor's gym scope
    /// (ADR-003); writes enforce the matching permission key.
    /// </summary>
    public interface IEvaluationService
    {
        // ---------------- Form builder (§5.3) ----------------

        /// <summary>Paged evaluation-form cards with question lists (evaluations.view).</summary>
        Task<EvaluationFormListResponse> GetFormsAsync(int? actorUserId, EvaluationFormListQuery query, CancellationToken cancellationToken = default);

        /// <summary>One evaluation form with questionList (evaluations.view).</summary>
        Task<EvaluationFormResponse> GetFormAsync(int? actorUserId, int formId, CancellationToken cancellationToken = default);

        /// <summary>Creates an evaluation form + question rows (evaluations.forms.manage) → 201.</summary>
        Task<EvaluationFormResponse> CreateFormAsync(int? actorUserId, UpsertEvaluationFormRequest request, CancellationToken cancellationToken = default);

        /// <summary>Replaces an evaluation form's fields and questions (evaluations.forms.manage).</summary>
        Task<EvaluationFormResponse> UpdateFormAsync(int? actorUserId, int formId, UpsertEvaluationFormRequest request, CancellationToken cancellationToken = default);

        /// <summary>Deletes a form with no submissions — otherwise 400 (evaluations.forms.manage) → 204.</summary>
        Task DeleteFormAsync(int? actorUserId, int formId, CancellationToken cancellationToken = default);

        /// <summary>Hiring-form card list with applicants counts — admin mode (evaluations.view); anonymous mode returns open forms only (§5.2 public view).</summary>
        Task<HiringFormListResponse> GetHiringFormsAsync(int? actorUserId, HiringFormListQuery query, CancellationToken cancellationToken = default);

        /// <summary>One hiring form — admins (evaluations.view) see any status, anonymous visitors only Open (§5.2).</summary>
        Task<HiringFormResponse> GetHiringFormAsync(int? actorUserId, int formId, CancellationToken cancellationToken = default);

        /// <summary>Creates a hiring form (evaluations.forms.manage) → 201.</summary>
        Task<HiringFormResponse> CreateHiringFormAsync(int? actorUserId, UpsertHiringFormRequest request, CancellationToken cancellationToken = default);

        /// <summary>Replaces a hiring form's fields and questions (evaluations.forms.manage).</summary>
        Task<HiringFormResponse> UpdateHiringFormAsync(int? actorUserId, int formId, UpsertHiringFormRequest request, CancellationToken cancellationToken = default);

        /// <summary>Deletes a hiring form with no applications — otherwise 400 (evaluations.forms.manage) → 204.</summary>
        Task DeleteHiringFormAsync(int? actorUserId, int formId, CancellationToken cancellationToken = default);

        // ---------------- Evaluations page (§5.4) ----------------

        /// <summary>Routes a running form to every eligible evaluator (evaluations.manage).</summary>
        Task<DispatchResponse> DispatchAsync(int? actorUserId, int formId, CancellationToken cancellationToken = default);

        /// <summary>The signed-in evaluator's assignment cards (any team/evaluations key).</summary>
        Task<AssignmentListResponse> GetAssignmentsAsync(int? actorUserId, AssignmentListQuery query, CancellationToken cancellationToken = default);

        /// <summary>Submits an evaluation — free-run or assigned (manage key / assignment holder) → 201.</summary>
        Task<SubmitEvaluationResponse> SubmitResponseAsync(int? actorUserId, int formId, SubmitEvaluationRequest request, CancellationToken cancellationToken = default);

        /// <summary>Seeds In Progress history rows for all eligible (evaluations.manage) → 201.</summary>
        Task<LaunchCycleResponse> LaunchCycleAsync(int? actorUserId, int formId, LaunchCycleRequest request, CancellationToken cancellationToken = default);

        /// <summary>Org-wide evaluation history with answers (evaluations.view).</summary>
        Task<EvaluationResponseListResponse> GetResponsesAsync(int? actorUserId, EvaluationResponseListQuery query, CancellationToken cancellationToken = default);

        /// <summary>History filtered to one form (evaluations.view) — 404 for unknown forms.</summary>
        Task<EvaluationResponseListResponse> GetFormResponsesAsync(int? actorUserId, int formId, EvaluationResponseListQuery query, CancellationToken cancellationToken = default);

        /// <summary>Employee profile evaluations tab (evaluations.view).</summary>
        Task<EmployeeEvaluationResponse> GetEmployeeEvaluationsAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default);

        /// <summary>Performance-cycle chips (evaluations.view).</summary>
        Task<PerformanceCycleResponse> GetPerformanceCyclesAsync(int? actorUserId, CancellationToken cancellationToken = default);

        /// <summary>Paged goals (evaluations.view).</summary>
        Task<GoalListResponse> GetGoalsAsync(int? actorUserId, GoalListQuery query, CancellationToken cancellationToken = default);

        /// <summary>Creates a goal from the + Add form (evaluations.manage) → 201.</summary>
        Task<GoalResponse> CreateGoalAsync(int? actorUserId, CreateGoalRequest request, CancellationToken cancellationToken = default);
    }
}
