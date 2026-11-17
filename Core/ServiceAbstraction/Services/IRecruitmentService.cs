using Shared.DataTransferObject.Recruitment;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Recruitment & hiring (api-spec-from-ui.md §5.1): vacancies, vacancy requests,
    /// the candidate pipeline, interviews, the waiting list, the hire wizard, and the
    /// New Comers onboarding checklist. Every method is permission- and gym-scoped
    /// through <c>IAccessControlService</c> (ADR-003).
    /// </summary>
    public interface IRecruitmentService
    {
        // ---- Vacancies ----
        Task<VacancyListResponse> GetVacanciesAsync(int? actorUserId, VacancyListQuery query, CancellationToken cancellationToken = default);
        Task<VacancyDetailResponse> GetVacancyAsync(int? actorUserId, int vacancyId, CancellationToken cancellationToken = default);
        Task<VacancyDataResponse> CreateVacancyAsync(int? actorUserId, CreateVacancyRequest request, CancellationToken cancellationToken = default);
        Task<VacancyDataResponse> UpdateVacancyAsync(int? actorUserId, int vacancyId, UpdateVacancyRequest request, CancellationToken cancellationToken = default);

        // ---- Vacancy requests ----
        Task<VacancyRequestListResponse> GetVacancyRequestsAsync(int? actorUserId, VacancyRequestListQuery query, CancellationToken cancellationToken = default);
        Task<VacancyRequestDataResponse> CreateVacancyRequestAsync(int? actorUserId, CreateVacancyRequestBody request, CancellationToken cancellationToken = default);
        Task<VacancyRequestDecisionResponse> DecideVacancyRequestAsync(int? actorUserId, int requestId, DecideVacancyRequestRequest request, CancellationToken cancellationToken = default);
        Task<ReopenVacancyRequestResponse> ReopenVacancyRequestAsync(int? actorUserId, int requestId, CancellationToken cancellationToken = default);

        // ---- Candidates / pipeline ----
        Task<CandidateListResponse> GetCandidatesAsync(int? actorUserId, CandidateListQuery query, CancellationToken cancellationToken = default);
        Task<CandidateDataResponse> GetCandidateAsync(int? actorUserId, int candidateId, CancellationToken cancellationToken = default);
        Task<CandidateBlockResponse> SetCandidateBlockAsync(int? actorUserId, int candidateId, BlockCandidateRequest request, CancellationToken cancellationToken = default);
        Task<ApplicationStageResponse> ChangeApplicationStageAsync(int? actorUserId, int applicationId, ChangeApplicationStageRequest request, CancellationToken cancellationToken = default);
        Task<CandidateListResponse> GetFollowUpsAsync(int? actorUserId, int page, int pageSize, CancellationToken cancellationToken = default);

        // ---- Interviews ----
        Task<InterviewListResponse> GetInterviewsAsync(int? actorUserId, InterviewListQuery query, CancellationToken cancellationToken = default);
        Task<InterviewDataResponse> GetInterviewAsync(int? actorUserId, int interviewId, CancellationToken cancellationToken = default);
        Task<InterviewDataResponse> CreateInterviewAsync(int? actorUserId, CreateInterviewRequest request, CancellationToken cancellationToken = default);
        Task<InterviewDataResponse> CompleteInterviewAsync(int? actorUserId, int interviewId, CancellationToken cancellationToken = default);
        Task<ReminderResponse> SendInterviewReminderAsync(int? actorUserId, int interviewId, CancellationToken cancellationToken = default);

        // ---- Waiting list ----
        Task<WaitingListResponse> GetWaitingListAsync(int? actorUserId, WaitingListQuery query, CancellationToken cancellationToken = default);
        Task<AssignWaitingDataResponse> AssignWaitingCandidateAsync(int? actorUserId, int applicationId, AssignWaitingRequest request, CancellationToken cancellationToken = default);
        Task RemoveFromWaitingListAsync(int? actorUserId, int applicationId, CancellationToken cancellationToken = default);

        // ---- Public hiring-form applications (§5.2) ----
        /// <summary>Anonymous form submission → 201 { message } (rate-limited at the controller).</summary>
        Task<SubmitFormApplicationResponse> SubmitFormApplicationAsync(SubmitFormApplicationRequest request, CancellationToken cancellationToken = default);

        /// <summary>Applicant list of the Hiring tab (recruitment.candidates.manage, gym-filtered).</summary>
        Task<FormApplicationListResponse> GetFormApplicationsAsync(int? actorUserId, FormApplicationListQuery query, CancellationToken cancellationToken = default);

        /// <summary>One applicant with its answers (recruitment.candidates.manage).</summary>
        Task<FormApplicationDetailResponse> GetFormApplicationAsync(int? actorUserId, int applicationId, CancellationToken cancellationToken = default);

        /// <summary>Marks an applicant Rejected with an optional comment (recruitment.candidates.manage).</summary>
        Task<RejectFormApplicationResponse> RejectFormApplicationAsync(int? actorUserId, int applicationId, RejectFormApplicationRequest request, CancellationToken cancellationToken = default);

        /// <summary>"Add to Pipeline": creates the Candidate + vacancy-less application and flips the row to Moved to Pipeline (recruitment.candidates.manage) → 201.</summary>
        Task<ConvertToCandidateResponse> ConvertApplicationToCandidateAsync(int? actorUserId, ConvertToCandidateRequest request, CancellationToken cancellationToken = default);

        // ---- Hire wizard ----
        Task<HireDataResponse> HireCandidateAsync(int? actorUserId, int applicationId, HireApplicationRequest request, CancellationToken cancellationToken = default);

        // ---- New Comers / onboarding ----
        Task<NewComerListResponse> GetNewComersAsync(int? actorUserId, CancellationToken cancellationToken = default);
        Task<OnboardingChecklistResponse> UpdateOnboardingChecklistAsync(int? actorUserId, int employeeId, OnboardingChecklistRequest request, CancellationToken cancellationToken = default);
    }
}
