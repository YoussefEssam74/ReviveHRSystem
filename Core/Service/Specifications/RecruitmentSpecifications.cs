using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RecruitmentModule.Enums;

namespace Service.Specifications
{
    /// <summary>
    /// Recruitment specifications (api-spec-from-ui.md §5.1). Gym scoping is always
    /// applied on the vacancy's gym; a null/empty gym array matches nobody (never all).
    /// A take of 0 means "no paging" — used for companion count queries.
    /// </summary>
    public sealed class VacancyListSpec : BaseSpecification<Vacancy, int>
    {
        public VacancyListSpec(int[]? gymIds, VacancyStatus? status, string? search, int skip, int take, string? sortBy, bool descending)
        {
            Criteria = v =>
                (gymIds == null || gymIds.Length == 0 || gymIds.Contains(v.GymId)) &&
                (status == null || v.Status == status) &&
                (search == null || v.Title.ToLower().Contains(search.ToLower())
                    || v.Position.Title.ToLower().Contains(search.ToLower())
                    || v.Gym.Name.ToLower().Contains(search.ToLower()));

            AddInclude(v => v.Gym);
            AddInclude(v => v.Position);
            AddInclude(v => v.Applications);

            switch (sortBy?.Trim().ToLowerInvariant())
            {
                case "position":
                    if (descending) { OrderByDescending = v => v.Title; } else { OrderBy = v => v.Title; }
                    break;
                case "headcount":
                    if (descending) { OrderByDescending = v => v.HeadcountNeeded; } else { OrderBy = v => v.HeadcountNeeded; }
                    break;
                default:
                    // Default sort: newest first (the UI's table order).
                    if (descending) { OrderBy = v => v.CreatedDate; } else { OrderByDescending = v => v.CreatedDate; }
                    break;
            }

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>One vacancy with gym, position, and applications (detail + create/update re-read).</summary>
    public sealed class VacancyByIdSpec : BaseSpecification<Vacancy, int>
    {
        public VacancyByIdSpec(int vacancyId)
        {
            Criteria = v => v.Id == vacancyId;
            AddInclude(v => v.Gym);
            AddInclude(v => v.Position);
            AddInclude(v => v.Applications);
        }
    }

    /// <summary>A vacancy's applications with every navigation the funnel/candidate cards need.</summary>
    public sealed class ApplicationsByVacancySpec : BaseSpecification<Application, int>
    {
        public ApplicationsByVacancySpec(int vacancyId)
        {
            Criteria = a => a.VacancyId == vacancyId;
            AddInclude(a => a.Candidate);
            AddInclude(a => a.Vacancy!.Gym);
            AddInclude(a => a.Vacancy!.Position);
            AddInclude(a => a.Interviews);
            AddInclude(a => a.PipelineStages);
            OrderByDescending = a => a.AppliedDate;
        }
    }

    /// <summary>Open vacancies in scope (waiting-list matching).</summary>
    public sealed class OpenVacanciesSpec : BaseSpecification<Vacancy, int>
    {
        public OpenVacanciesSpec(int[]? gymIds)
        {
            Criteria = v => v.Status == VacancyStatus.Open
                && (gymIds == null || gymIds.Length == 0 || gymIds.Contains(v.GymId));
            AddInclude(v => v.Gym);
            AddInclude(v => v.Position);
        }
    }

    /// <summary>Vacancy requests queue (status tabs + gym filter).</summary>
    public sealed class VacancyRequestListSpec : BaseSpecification<VacancyRequest, int>
    {
        public VacancyRequestListSpec(int[]? gymIds, VacancyRequestStatus? status, int skip, int take)
        {
            Criteria = vr =>
                (gymIds == null || gymIds.Length == 0 || gymIds.Contains(vr.GymId)) &&
                (status == null || vr.Status == status);

            AddInclude(vr => vr.Gym);
            AddInclude(vr => vr.Position);
            AddInclude(vr => vr.Requester);
            AddInclude(vr => vr.Decider);
            OrderByDescending = vr => vr.Id;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>One vacancy request with all decision navigations.</summary>
    public sealed class VacancyRequestByIdSpec : BaseSpecification<VacancyRequest, int>
    {
        public VacancyRequestByIdSpec(int requestId)
        {
            Criteria = vr => vr.Id == requestId;
            AddInclude(vr => vr.Gym);
            AddInclude(vr => vr.Position);
            AddInclude(vr => vr.Requester);
            AddInclude(vr => vr.Decider);
        }
    }

    /// <summary>Hiring-form applicants (the Hiring tab's applicant pane, §5.2).</summary>
    public sealed class FormApplicationListSpec : BaseSpecification<HiringFormApplication, int>
    {
        public FormApplicationListSpec(int[]? scopeIds, string[] scopeNames, int? formId, string? status, string? search, int skip, int take)
        {
            var cleanStatus = string.IsNullOrWhiteSpace(status) ? null : status.Trim();
            var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

            Criteria = a =>
                (formId == null || a.HiringFormId == formId) &&
                (cleanStatus == null || a.Status == cleanStatus) &&
                (scopeIds == null || scopeIds.Length == 0 || a.Gym == null || scopeNames.Contains(a.Gym)) &&
                (term == null || a.Name.ToLower().Contains(term)
                    || a.Email.ToLower().Contains(term)
                    || a.Phone.ToLower().Contains(term));

            AddInclude(a => a.HiringForm);
            OrderByDescending = a => a.AppliedDate;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>One hiring-form applicant with its form.</summary>
    public sealed class FormApplicationByIdSpec : BaseSpecification<HiringFormApplication, int>
    {
        public FormApplicationByIdSpec(int applicationId)
        {
            Criteria = a => a.Id == applicationId;
            AddInclude(a => a.HiringForm);
        }
    }

    /// <summary>
    /// The candidate pipeline list — one card per application (the UI's normal case is
    /// one application per candidate), with every navigation the card shape needs.
    /// </summary>
    public sealed class ApplicationPipelineSpec : BaseSpecification<Application, int>
    {
        public ApplicationPipelineSpec(
            int[]? gymIds,
            string[]? gymNames,
            PipelineStageType? stage,
            string? position,
            string? view,
            bool? blocked,
            string? search,
            int skip,
            int take,
            string? sortBy,
            bool descending)
        {
            var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();
            var positionTerm = string.IsNullOrWhiteSpace(position) ? null : position.Trim().ToLower();
            var names = gymNames ?? Array.Empty<string>();

            Criteria = a =>
                (gymIds == null || gymIds.Length == 0 ||
                    gymIds.Contains(a.Vacancy!.GymId) ||
                    (a.VacancyId == null && (a.PreferredGym == null || names.Contains(a.PreferredGym)))) &&
                (stage == null || a.CurrentStage == stage) &&
                (positionTerm == null ||
                    a.Vacancy!.Position.Title.ToLower().Contains(positionTerm) ||
                    (a.PositionTitle != null && a.PositionTitle.ToLower().Contains(positionTerm))) &&
                (view != "rejected" || a.Status == ApplicationStatus.Rejected) &&
                (view != "active" || (a.Status == ApplicationStatus.InProgress && !a.Candidate.Blocked)) &&
                (blocked == null || a.Candidate.Blocked == blocked) &&
                (term == null || a.Candidate.FullName.ToLower().Contains(term)
                    || a.Candidate.Email.ToLower().Contains(term)
                    || a.Candidate.Phone.ToLower().Contains(term)
                    || a.Vacancy!.Position.Title.ToLower().Contains(term)
                    || (a.PositionTitle != null && a.PositionTitle.ToLower().Contains(term)));

            AddInclude(a => a.Candidate);
            AddInclude(a => a.Vacancy!.Gym);
            AddInclude(a => a.Vacancy!.Position);
            AddInclude(a => a.Interviews);
            AddInclude(a => a.PipelineStages);

            switch (sortBy?.Trim().ToLowerInvariant())
            {
                case "applied":
                    if (descending) { OrderByDescending = a => a.AppliedDate; } else { OrderBy = a => a.AppliedDate; }
                    break;
                case "name":
                    if (descending) { OrderByDescending = a => a.Candidate.FullName; } else { OrderBy = a => a.Candidate.FullName; }
                    break;
                default:
                    if (descending) { OrderBy = a => a.AppliedDate; } else { OrderByDescending = a => a.AppliedDate; }
                    break;
            }

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>One pipeline application with every navigation the detail modal renders.</summary>
    public sealed class ApplicationByIdSpec : BaseSpecification<Application, int>
    {
        public ApplicationByIdSpec(int applicationId)
        {
            Criteria = a => a.Id == applicationId;
            AddInclude(a => a.Candidate);
            AddInclude(a => a.Vacancy!.Gym);
            AddInclude(a => a.Vacancy!.Position);
            AddInclude(a => a.Interviews);
            AddInclude(a => a.PipelineStages);
        }
    }

    /// <summary>All applications of one candidate (detail resolves the latest).</summary>
    public sealed class ApplicationsByCandidateSpec : BaseSpecification<Application, int>
    {
        public ApplicationsByCandidateSpec(int candidateId)
        {
            Criteria = a => a.CandidateId == candidateId;
            AddInclude(a => a.Candidate);
            AddInclude(a => a.Vacancy!.Gym);
            AddInclude(a => a.Vacancy!.Position);
            AddInclude(a => a.Interviews);
            AddInclude(a => a.PipelineStages);
            OrderByDescending = a => a.AppliedDate;
        }
    }

    /// <summary>One candidate row (block/restore path).</summary>
    public sealed class CandidateByIdSpec : BaseSpecification<Candidate, int>
    {
        public CandidateByIdSpec(int candidateId)
        {
            Criteria = c => c.Id == candidateId;
        }
    }

    /// <summary>Candidates by email (duplicate application guard).</summary>
    public sealed class CandidateByEmailSpec : BaseSpecification<Candidate, int>
    {
        public CandidateByEmailSpec(string email)
        {
            var clean = email.Trim().ToLower();
            Criteria = c => c.Email.ToLower() == clean;
        }
    }

    /// <summary>Follow-ups: in-process applications with no stage activity for over 5 days.</summary>
    public sealed class StaleApplicationsSpec : BaseSpecification<Application, int>
    {
        public StaleApplicationsSpec(int[]? gymIds, string[]? gymNames, DateTime staleBefore, int skip, int take)
        {
            var names = gymNames ?? Array.Empty<string>();

            Criteria = a =>
                (gymIds == null || gymIds.Length == 0 ||
                    gymIds.Contains(a.Vacancy!.GymId) ||
                    (a.VacancyId == null && (a.PreferredGym == null || names.Contains(a.PreferredGym)))) &&
                a.Status == ApplicationStatus.InProgress &&
                a.CurrentStage != PipelineStageType.Hired &&
                a.CurrentStage != PipelineStageType.Rejected &&
                a.CurrentStage != PipelineStageType.Accepted &&
                a.LastActivityAt < staleBefore;

            AddInclude(a => a.Candidate);
            AddInclude(a => a.Vacancy!.Gym);
            AddInclude(a => a.Vacancy!.Position);
            AddInclude(a => a.Interviews);
            AddInclude(a => a.PipelineStages);
            OrderBy = a => a.LastActivityAt;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>The waiting list: applications parked with WaitingList status.</summary>
    public sealed class WaitingListApplicationsSpec : BaseSpecification<Application, int>
    {
        public WaitingListApplicationsSpec(int[]? gymIds, string[]? gymNames, string? position, int skip, int take)
        {
            var positionTerm = string.IsNullOrWhiteSpace(position) ? null : position.Trim().ToLower();
            var names = gymNames ?? Array.Empty<string>();

            Criteria = a =>
                a.Status == ApplicationStatus.WaitingList &&
                (gymIds == null || gymIds.Length == 0 ||
                    gymIds.Contains(a.Vacancy!.GymId) ||
                    (a.VacancyId == null && (a.PreferredGym == null || names.Contains(a.PreferredGym)))) &&
                (positionTerm == null ||
                    a.Vacancy!.Position.Title.ToLower().Contains(positionTerm) ||
                    (a.PositionTitle != null && a.PositionTitle.ToLower().Contains(positionTerm)));

            AddInclude(a => a.Candidate);
            AddInclude(a => a.Vacancy!.Gym);
            AddInclude(a => a.Vacancy!.Position);
            OrderBy = a => a.AppliedDate;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>Interviews calendar: gym + month/day/status filters.</summary>
    public sealed class InterviewListSpec : BaseSpecification<Interview, int>
    {
        public InterviewListSpec(int[]? gymIds, string[]? gymNames, DateTime? from, DateTime? to, string? status, int? candidateId, int skip, int take)
        {
            var completed = status is not null && status.Equals("completed", StringComparison.OrdinalIgnoreCase);
            var cancelled = status is not null && status.Equals("cancelled", StringComparison.OrdinalIgnoreCase);
            var onlyPending = status is not null && status.Equals("pending", StringComparison.OrdinalIgnoreCase);
            var names = gymNames ?? Array.Empty<string>();

            Criteria = i =>
                (gymIds == null || gymIds.Length == 0 ||
                    gymIds.Contains(i.Application!.Vacancy!.GymId) ||
                    (i.Application!.VacancyId == null &&
                        (i.Application!.PreferredGym == null || names.Contains(i.Application!.PreferredGym)))) &&
                (from == null || i.ScheduledDate >= from) &&
                (to == null || i.ScheduledDate < to) &&
                (candidateId == null || i.Application.CandidateId == candidateId) &&
                (!onlyPending || i.Status == "Scheduled" || i.Status == "Invited" || i.Status == "Draft") &&
                (!completed || i.Status == "Completed") &&
                (!cancelled || i.Status == "Cancelled");

            AddInclude(i => i.Application!.Candidate);
            AddInclude(i => i.Application!.Vacancy!.Gym);
            AddInclude(i => i.Application!.Vacancy!.Position);
            OrderBy = i => i.ScheduledDate;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>One interview with candidate + vacancy navigations.</summary>
    public sealed class InterviewByIdSpec : BaseSpecification<Interview, int>
    {
        public InterviewByIdSpec(int interviewId)
        {
            Criteria = i => i.Id == interviewId;
            AddInclude(i => i.Application!.Candidate);
            AddInclude(i => i.Application!.Vacancy!.Gym);
            AddInclude(i => i.Application!.Vacancy!.Position);
        }
    }

    /// <summary>
    /// New Comers: employees hired recently OR still carrying an incomplete onboarding
    /// checklist, at the actor's gyms.
    /// </summary>
    public sealed class NewComersSpec : BaseSpecification<Employee, int>
    {
        public NewComersSpec(int[]? gymIds, DateOnly hiredAfter)
        {
            Criteria = e =>
                (gymIds == null || gymIds.Length == 0 || gymIds.Contains(e.GymId)) &&
                (e.HireDate >= hiredAfter || e.OnboardingChecklistItems.Any(i => !i.IsCompleted));

            AddInclude(e => e.Position);
            AddInclude(e => e.OnboardingChecklistItems);
            OrderByDescending = e => e.HireDate;
        }
    }

    /// <summary>An employee's onboarding checklist (toggle path).</summary>
    public sealed class OnboardingItemsSpec : BaseSpecification<OnboardingChecklistItem, int>
    {
        public OnboardingItemsSpec(int employeeId)
        {
            Criteria = i => i.EmployeeId == employeeId;
            OrderBy = i => i.SortOrder;
        }
    }

    /// <summary>Active employees under a vacancy's position (the "employees under this position" panel).</summary>
    public sealed class EmployeesByPositionSpec : BaseSpecification<Employee, int>
    {
        public EmployeesByPositionSpec(int positionId)
        {
            Criteria = e => e.PositionId == positionId && e.Status == EmployeeStatus.Active;
            AddInclude(e => e.Position);
            AddInclude(e => e.Gym);
            OrderBy = e => e.FullName;
        }
    }
}
