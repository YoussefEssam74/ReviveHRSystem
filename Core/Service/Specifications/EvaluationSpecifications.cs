using DomainLayer.Contracts;
using DomainLayer.Models.EvaluationModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.RecruitmentModule;

namespace Service.Specifications
{
    /// <summary>
    /// Evaluations + form builder specifications (api-spec-from-ui.md §5.3/§5.4).
    /// Gym scoping follows the VacancyListSpec convention (null/empty scope = no
    /// filter); question lists ride member-path includes and answer questions are
    /// batch-loaded through their own spec (the evaluator cannot chain ThenInclude).
    /// </summary>
    public sealed class EvaluationFormListSpec : BaseSpecification<EvaluationForm, int>
    {
        public EvaluationFormListSpec(int[]? gymIds, int? gym, string? status, string? position, int skip, int take)
        {
            var cleanStatus = string.IsNullOrWhiteSpace(status) ? null : status.Trim();
            var cleanPosition = string.IsNullOrWhiteSpace(position) ? null : position.Trim();

            Criteria = f =>
                (gymIds == null || gymIds.Length == 0 || f.GymId == null || gymIds.Contains(f.GymId.Value)) &&
                (gym == null || f.GymId == null || f.GymId == gym) &&
                (cleanStatus == null || f.Status == cleanStatus) &&
                (cleanPosition == null ||
                    (f.Target != null && f.Target.ToLower() == cleanPosition.ToLower()) ||
                    (f.Position != null && f.Position.Title.ToLower() == cleanPosition.ToLower()));

            AddInclude(f => f.Questions);
            AddInclude(f => f.Gym!);
            AddInclude(f => f.Position!);
            AddInclude(f => f.Responses);
            OrderByDescending = f => f.CreatedDate;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>One evaluation form with its questions (detail + write paths).</summary>
    public sealed class EvaluationFormByIdSpec : BaseSpecification<EvaluationForm, int>
    {
        public EvaluationFormByIdSpec(int formId)
        {
            Criteria = f => f.Id == formId;
            AddInclude(f => f.Questions);
            AddInclude(f => f.Gym!);
            AddInclude(f => f.Position!);
            AddInclude(f => f.Responses);
            AddInclude(f => f.Assignments);
        }
    }

    /// <summary>Hiring form card list (Hiring tab).</summary>
    public sealed class HiringFormListSpec : BaseSpecification<HiringForm, int>
    {
        public HiringFormListSpec(int[]? gymIds, int? gym, string? status, string? position, int skip, int take)
        {
            var cleanStatus = string.IsNullOrWhiteSpace(status) ? null : status.Trim();
            var cleanPosition = string.IsNullOrWhiteSpace(position) ? null : position.Trim();

            Criteria = h =>
                (gymIds == null || gymIds.Length == 0 || h.GymId == null || gymIds.Contains(h.GymId.Value)) &&
                (gym == null || h.GymId == null || h.GymId == gym) &&
                (cleanStatus == null || h.Status == cleanStatus) &&
                (cleanPosition == null || (h.Position != null && h.Position.ToLower() == cleanPosition.ToLower()));

            AddInclude(h => h.Gym!);
            OrderByDescending = h => h.CreatedDate;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>One hiring form with its gym (admin detail + write paths).</summary>
    public sealed class HiringFormByIdSpec : BaseSpecification<HiringForm, int>
    {
        public HiringFormByIdSpec(int formId)
        {
            Criteria = h => h.Id == formId;
            AddInclude(h => h.Gym!);
        }
    }

    /// <summary>Org-wide evaluation history (History &amp; Trends tab).</summary>
    public sealed class EvaluationResponsesSpec : BaseSpecification<EvaluationResponse, int>
    {
        public EvaluationResponsesSpec(int[]? gymIds, int? gym, int? employeeId, int? formId, string? period, string? status, int skip, int take)
        {
            var cleanPeriod = string.IsNullOrWhiteSpace(period) ? null : period.Trim();
            var cleanStatus = string.IsNullOrWhiteSpace(status) ? null : status.Trim();

            Criteria = r =>
                (gymIds == null || gymIds.Length == 0 || gymIds.Contains(r.Employee.GymId)) &&
                (gym == null || r.Employee.GymId == gym) &&
                (employeeId == null || r.EmployeeId == employeeId) &&
                (formId == null || r.EvaluationFormId == formId) &&
                (cleanPeriod == null || r.Period == cleanPeriod) &&
                (cleanStatus == null || r.Status == cleanStatus);

            AddInclude(r => r.Employee);
            AddInclude(r => r.Employee.Gym);
            AddInclude(r => r.EvaluationForm);
            AddInclude(r => r.Evaluator);
            OrderByDescending = r => r.SubmittedAt;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>Answers of a page of responses, with their questions (type + text).</summary>
    public sealed class AnswersByResponsesSpec : BaseSpecification<EvaluationAnswer, int>
    {
        public AnswersByResponsesSpec(int[] responseIds)
        {
            var ids = responseIds;
            Criteria = a => ids.Contains(a.EvaluationResponseId);
            AddInclude(a => a.EvaluationQuestion);
        }
    }

    /// <summary>One employee's evaluation history (profile tab).</summary>
    public sealed class EmployeeResponsesSpec : BaseSpecification<EvaluationResponse, int>
    {
        public EmployeeResponsesSpec(int employeeId)
        {
            Criteria = r => r.EmployeeId == employeeId;
            AddInclude(r => r.Employee);
            AddInclude(r => r.Employee.Gym);
            AddInclude(r => r.EvaluationForm);
            OrderByDescending = r => r.SubmittedAt;
        }
    }

    /// <summary>Assignment rows grouped by (form, evaluator) for the inbox + dispatch dedupe.</summary>
    public sealed class AssignmentRowsSpec : BaseSpecification<EvaluationAssignment, int>
    {
        public AssignmentRowsSpec(int[]? formIds, int? evaluatorUserId, string? status, int skip, int take)
        {
            var cleanStatus = string.IsNullOrWhiteSpace(status) ? null : status.Trim();

            Criteria = a =>
                (formIds == null || formIds.Length == 0 || formIds.Contains(a.EvaluationFormId)) &&
                (evaluatorUserId == null || a.EvaluatorUserId == evaluatorUserId) &&
                (cleanStatus == null || a.Status == cleanStatus);

            AddInclude(a => a.EvaluationForm);
            AddInclude(a => a.Employee);
            AddInclude(a => a.Evaluator);
            AddInclude(a => a.AssignedByUser);
            OrderByDescending = a => a.AssignedAt;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>Active employees with position + gym for subject/eligibility derivation.</summary>
    public sealed class ActiveEmployeesForFormSpec : BaseSpecification<Employee, int>
    {
        public ActiveEmployeesForFormSpec()
        {
            Criteria = e => e.Status == EmployeeStatus.Active;
            AddInclude(e => e.Position);
            AddInclude(e => e.Gym);
        }
    }

    /// <summary>Paged goals for the History &amp; Trends tab (newest first).</summary>
    public sealed class GoalsListSpec : BaseSpecification<Goal, int>
    {
        public GoalsListSpec(int skip, int take)
        {
            Criteria = g => true;
            AddInclude(g => g.Employee!);
            OrderByDescending = g => g.Id;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>Application counts per hiring form (card "applicants").</summary>
    public sealed class ApplicationsByFormsSpec : BaseSpecification<HiringFormApplication, int>
    {
        public ApplicationsByFormsSpec(int[] formIds)
        {
            var ids = formIds;
            Criteria = a => ids.Contains(a.HiringFormId);
        }
    }
}
