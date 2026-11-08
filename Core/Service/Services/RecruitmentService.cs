using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Recruitment;
using System.Globalization;
using System.Text.Json;

namespace Service.Services
{
    /// <summary>
    /// Recruitment &amp; hiring (api-spec-from-ui.md §5.1): vacancies, vacancy requests,
    /// the candidate pipeline (applications + stages + interviews), the waiting list,
    /// the hire wizard, and the New Comers onboarding checklist.
    ///
    /// Model notes the service encodes:
    /// - The pipeline is one card per Application (the UI's normal case is one
    ///   application per candidate); candidate detail resolves the latest application.
    /// - Stage moves are recorded as PipelineStage rows and bump Application.LastActivityAt
    ///   (the follow-up engine's staleness clock).
    /// - Hired is only reachable through the hire wizard (POST /applications/{id}/hire or
    ///   the waiting-list assign) so an Employee + User account is always created with it
    ///   (PROJECT.md rule 6: Candidate ≠ Employee until the Hired transition).
    /// - Gym scoping: Top Management sees everything, everyone else is intersected with
    ///   their UserGymAccess rows; an empty scope lists nothing (never everything).
    /// </summary>
    public sealed class RecruitmentService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess,
        IPasswordHasher _passwordHasher) : IRecruitmentService
    {
        // Mirrors ReviveHRSystem.Web.DataSeed.DevelopmentDataSeeder.EmployeePassword and
        // EmployeeService.DefaultNewAccountPassword (Core cannot reference the Web host).
        private const string DefaultNewAccountPassword = "Revive!2026";
        private const int DefaultPageSize = 20;
        private const int MaxPageSize = 100;
        private const int FollowUpStalenessDays = 5;
        private const int NewComerLookbackDays = 30;

        private static readonly string[] DefaultOnboardingChecklist =
        [
            "ID & contract signed",
            "Uniform issued",
            "System access created",
            "Branch tour completed",
            "Welcome meeting with BM",
        ];

        // ==================================================================
        // Vacancies
        // ==================================================================

        public async Task<VacancyListResponse> GetVacanciesAsync(int? actorUserId, VacancyListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.view", query.Gym, cancellationToken);
            var gymIds = await ResolveGymScopeAsync(actor, query.Gym, cancellationToken);

            var status = ParseVacancyStatusOrNull(query.Status);
            var page = Math.Max(query.Page, 1);
            var pageSize = NormalizePageSize(query.PageSize);
            var search = NullIfBlank(query.SearchTerm);
            var descending = !string.Equals(query.SortOrder, "asc", StringComparison.OrdinalIgnoreCase);

            var total = await _unitOfWork.GetRepository<Vacancy, int>()
                .CountAsync(new VacancyListSpec(gymIds, status, search, 0, 0, query.SortBy, descending), cancellationToken);
            var vacancies = await _unitOfWork.GetRepository<Vacancy, int>()
                .GetAllAsync(new VacancyListSpec(gymIds, status, search, (page - 1) * pageSize, pageSize, query.SortBy, descending), cancellationToken);

            var names = await LoadUserDisplayNamesAsync(
                vacancies.Select(v => (int?)v.RequestedBy), cancellationToken);

            return new VacancyListResponse
            {
                Items = vacancies.Select(v => BuildVacancyItem(v, names)).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<VacancyDetailResponse> GetVacancyAsync(int? actorUserId, int vacancyId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var vacancy = await _unitOfWork.GetRepository<Vacancy, int>()
                .GetByIdAsync(new VacancyByIdSpec(vacancyId), cancellationToken)
                ?? throw new NotFoundException("Vacancy not found.");
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.view", vacancy.GymId, cancellationToken);

            var names = await LoadUserDisplayNamesAsync([(int?)vacancy.RequestedBy], cancellationToken);
            var employees = await _unitOfWork.GetRepository<Employee, int>()
                .GetAllAsync(new EmployeesByPositionSpec(vacancy.PositionId), cancellationToken);
            // Applications are loaded through their own spec: the expression-based
            // includes cannot reach Applications.Candidate in one go.
            var applications = await _unitOfWork.GetRepository<Application, int>()
                .GetAllAsync(new ApplicationsByVacancySpec(vacancyId), cancellationToken);

            return new VacancyDetailResponse
            {
                Data = BuildVacancyItem(vacancy, names),
                Funnel = applications
                    .GroupBy(a => StageDisplay(a.CurrentStage))
                    .Select(g => new VacancyFunnelStage { Stage = g.Key, Count = g.Count() })
                    .OrderBy(f => f.Stage, StringComparer.Ordinal)
                    .ToList(),
                EmployeesUnderPosition = employees.Select(e => new VacancyEmployeeItem
                {
                    Id = e.Id,
                    Name = e.FullName,
                    Initials = BuildInitials(e.FullName),
                    Position = e.Position?.Title,
                    Gym = e.Gym?.Name,
                }).ToList(),
                Candidates = applications
                    .Select(BuildCandidateItem)
                    .ToList(),
            };
        }

        public async Task<VacancyDataResponse> CreateVacancyAsync(int? actorUserId, CreateVacancyRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var gym = await ResolveGymAsync(actor, request.GymId, request.Gym, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.vacancies.manage", gym.Id, cancellationToken);

            var title = NullIfBlank(request.Position)
                ?? throw new BadRequestException("Position is required.");
            var position = await ResolvePositionAsync(gym.Id, title, cancellationToken);
            var headcount = request.HeadcountNeeded <= 0 ? 1 : request.HeadcountNeeded;
            var status = ParseVacancyWriteStatusOrNull(request.Status) ?? VacancyStatus.Open;

            var vacancy = new Vacancy
            {
                GymId = gym.Id,
                PositionId = position.Id,
                Title = position.Title,
                Description = NullIfBlank(request.JobDescription) ?? string.Empty,
                Requirements = NullIfBlank(request.Requirements) ?? string.Empty,
                HeadcountNeeded = headcount,
                PublicLinkToken = $"vac-{Guid.NewGuid():N}",
                Status = status,
                Urgency = NormalizeUrgency(request.Urgency),
                Salary = request.Salary,
                Shift = NullIfBlank(request.Shift),
                Source = NullIfBlank(request.Source),
                RequestedBy = actor.Id,
            };

            await _unitOfWork.GetRepository<Vacancy, int>().AddAsync(vacancy, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var created = await _unitOfWork.GetRepository<Vacancy, int>()
                .GetByIdAsync(new VacancyByIdSpec(vacancy.Id), cancellationToken)
                ?? throw new NotFoundException("Vacancy not found.");
            var names = await LoadUserDisplayNamesAsync([(int?)created.RequestedBy], cancellationToken);
            return new VacancyDataResponse { Data = BuildVacancyItem(created, names) };
        }

        public async Task<VacancyDataResponse> UpdateVacancyAsync(int? actorUserId, int vacancyId, UpdateVacancyRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var vacancy = await _unitOfWork.GetRepository<Vacancy, int>()
                .GetByIdAsync(new VacancyByIdSpec(vacancyId), cancellationToken)
                ?? throw new NotFoundException("Vacancy not found.");
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.vacancies.manage", vacancy.GymId, cancellationToken);

            if (request.GymId is not null || NullIfBlank(request.Gym) is not null)
            {
                var gym = await ResolveGymAsync(actor, request.GymId, request.Gym, cancellationToken);
                if (gym.Id != vacancy.GymId)
                {
                    vacancy.GymId = gym.Id;
                    vacancy.PositionId = (await ResolvePositionAsync(gym.Id,
                        NullIfBlank(request.Position) ?? vacancy.Title, cancellationToken)).Id;
                    vacancy.Title = vacancy.Position?.Title ?? vacancy.Title;
                }
            }

            if (NullIfBlank(request.Position) is string positionTitle)
            {
                var position = await ResolvePositionAsync(vacancy.GymId, positionTitle, cancellationToken);
                vacancy.PositionId = position.Id;
                vacancy.Title = position.Title;
            }

            if (request.HeadcountNeeded is int headcount && headcount > 0) vacancy.HeadcountNeeded = headcount;
            if (request.Urgency is not null) vacancy.Urgency = NormalizeUrgency(request.Urgency);
            if (request.Salary is not null) vacancy.Salary = request.Salary;
            if (NullIfBlank(request.Shift) is string shift) vacancy.Shift = shift;
            if (NullIfBlank(request.Source) is string source) vacancy.Source = source;
            if (NullIfBlank(request.JobDescription) is string description) vacancy.Description = description;
            if (NullIfBlank(request.Requirements) is string requirements) vacancy.Requirements = requirements;
            if (ParseVacancyWriteStatusOrNull(request.Status) is VacancyStatus status) vacancy.Status = status;

            _unitOfWork.GetRepository<Vacancy, int>().Update(vacancy);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var updated = await _unitOfWork.GetRepository<Vacancy, int>()
                .GetByIdAsync(new VacancyByIdSpec(vacancy.Id), cancellationToken)
                ?? throw new NotFoundException("Vacancy not found.");
            var names = await LoadUserDisplayNamesAsync([(int?)updated.RequestedBy], cancellationToken);
            return new VacancyDataResponse { Data = BuildVacancyItem(updated, names) };
        }

        // ==================================================================
        // Vacancy requests
        // ==================================================================

        public async Task<VacancyRequestListResponse> GetVacancyRequestsAsync(int? actorUserId, VacancyRequestListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.view", query.Gym, cancellationToken);
            var gymIds = await ResolveGymScopeAsync(actor, query.Gym, cancellationToken);

            var status = ParseVacancyRequestStatusOrNull(query.Status);
            var page = Math.Max(query.Page, 1);
            var pageSize = NormalizePageSize(query.PageSize);

            var total = await _unitOfWork.GetRepository<VacancyRequest, int>()
                .CountAsync(new VacancyRequestListSpec(gymIds, status, 0, 0), cancellationToken);
            var requests = await _unitOfWork.GetRepository<VacancyRequest, int>()
                .GetAllAsync(new VacancyRequestListSpec(gymIds, status, (page - 1) * pageSize, pageSize), cancellationToken);

            var names = await LoadUserDisplayNamesAsync(
                requests.SelectMany(r => new[] { (int?)r.RequestedBy, r.DecidedBy }), cancellationToken);

            return new VacancyRequestListResponse
            {
                Items = requests.Select(r => BuildVacancyRequestItem(r, names)).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<VacancyRequestDataResponse> CreateVacancyRequestAsync(int? actorUserId, CreateVacancyRequestBody request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var gym = await ResolveGymAsync(actor, request.GymId, request.Gym, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.vacancy_request.create", gym.Id, cancellationToken);

            var title = NullIfBlank(request.Position)
                ?? throw new BadRequestException("Position is required.");
            var reason = NullIfBlank(request.Reason)
                ?? throw new BadRequestException("Reason is required.");
            var position = await ResolvePositionAsync(gym.Id, title, cancellationToken);

            var entity = new VacancyRequest
            {
                GymId = gym.Id,
                PositionId = position.Id,
                RequestedBy = actor.Id,
                Justification = reason,
                Status = VacancyRequestStatus.Pending,
                Urgency = NormalizeUrgency(request.Urgency),
                Salary = request.Salary,
                Shift = NullIfBlank(request.Shift),
                Headcount = request.Headcount <= 0 ? 1 : request.Headcount,
            };

            await _unitOfWork.GetRepository<VacancyRequest, int>().AddAsync(entity, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var created = await _unitOfWork.GetRepository<VacancyRequest, int>()
                .GetByIdAsync(new VacancyRequestByIdSpec(entity.Id), cancellationToken)
                ?? throw new NotFoundException("Vacancy request not found.");
            var names = await LoadUserDisplayNamesAsync(
                new[] { (int?)created.RequestedBy, created.DecidedBy }, cancellationToken);
            return new VacancyRequestDataResponse { Data = BuildVacancyRequestItem(created, names) };
        }

        public async Task<VacancyRequestDecisionResponse> DecideVacancyRequestAsync(int? actorUserId, int requestId, DecideVacancyRequestRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var entity = await _unitOfWork.GetRepository<VacancyRequest, int>()
                .GetByIdAsync(new VacancyRequestByIdSpec(requestId), cancellationToken)
                ?? throw new NotFoundException("Vacancy request not found.");
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.vacancy_request.approve", entity.GymId, cancellationToken);

            if (entity.Status != VacancyRequestStatus.Pending)
            {
                throw new BadRequestException("This vacancy request has already been decided. Re-open it first to change the decision.");
            }

            var decision = NullIfBlank(request.Decision)
                ?? throw new BadRequestException("Decision must be Approved or Rejected.");
            entity.DecidedBy = actor.Id;
            entity.DecidedAt = DateTime.UtcNow;
            entity.DecisionComment = NullIfBlank(request.Comment);

            if (decision.Equals("Approved", StringComparison.OrdinalIgnoreCase))
            {
                // Approving creates the resulting public Vacancy (the request's own
                // fields are the defaults; the decide body may override them).
                var positionId = request.PositionId ?? entity.PositionId;
                var position = await _unitOfWork.GetRepository<Position, int>()
                    .GetByIdAsync(positionId, cancellationToken)
                    ?? throw new BadRequestException("Approve requires a valid position to create the vacancy.");

                var vacancy = new Vacancy
                {
                    GymId = entity.GymId,
                    PositionId = position.Id,
                    Title = position.Title,
                    Description = NullIfBlank(request.JobDescription) ?? entity.Justification,
                    Requirements = string.Empty,
                    HeadcountNeeded = request.HeadcountNeeded is > 0 ? request.HeadcountNeeded.Value : entity.Headcount,
                    PublicLinkToken = $"vac-{Guid.NewGuid():N}",
                    Status = VacancyStatus.Open,
                    Urgency = NormalizeUrgency(request.Urgency ?? entity.Urgency),
                    Salary = request.Salary ?? entity.Salary,
                    Shift = request.Shift ?? entity.Shift,
                    Source = "Vacancy Request",
                    RequestedBy = actor.Id,
                };
                await _unitOfWork.GetRepository<Vacancy, int>().AddAsync(vacancy, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                entity.Status = VacancyRequestStatus.Approved;
                entity.ResultingVacancyId = vacancy.Id;
            }
            else if (decision.Equals("Rejected", StringComparison.OrdinalIgnoreCase))
            {
                entity.Status = VacancyRequestStatus.Rejected;
            }
            else
            {
                throw new BadRequestException("Decision must be Approved or Rejected.");
            }

            _unitOfWork.GetRepository<VacancyRequest, int>().Update(entity);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var decided = await _unitOfWork.GetRepository<VacancyRequest, int>()
                .GetByIdAsync(new VacancyRequestByIdSpec(entity.Id), cancellationToken)
                ?? throw new NotFoundException("Vacancy request not found.");
            var names = await LoadUserDisplayNamesAsync(
                new[] { (int?)decided.RequestedBy, decided.DecidedBy }, cancellationToken);
            return new VacancyRequestDecisionResponse { Data = BuildVacancyRequestItem(decided, names) };
        }

        public async Task<ReopenVacancyRequestResponse> ReopenVacancyRequestAsync(int? actorUserId, int requestId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var entity = await _unitOfWork.GetRepository<VacancyRequest, int>()
                .GetByIdAsync(new VacancyRequestByIdSpec(requestId), cancellationToken)
                ?? throw new NotFoundException("Vacancy request not found.");
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.vacancy_request.approve", entity.GymId, cancellationToken);

            if (entity.Status == VacancyRequestStatus.Pending)
            {
                throw new BadRequestException("This vacancy request is already pending.");
            }

            // Withdraw the vacancy the approval created — but only while it has no
            // applicants (an applicant-facing posting is never silently pulled).
            var withdrawn = false;
            if (entity.ResultingVacancyId is int vacancyId)
            {
                var vacancy = await _unitOfWork.GetRepository<Vacancy, int>()
                    .GetByIdAsync(new VacancyByIdSpec(vacancyId), cancellationToken);
                if (vacancy is not null && vacancy.Applications.Count == 0)
                {
                    _unitOfWork.GetRepository<Vacancy, int>().Remove(vacancy);
                    entity.ResultingVacancyId = null;
                    withdrawn = true;
                }
            }

            entity.Status = VacancyRequestStatus.Pending;
            entity.DecidedBy = null;
            entity.DecidedAt = null;
            entity.DecisionComment = null;
            _unitOfWork.GetRepository<VacancyRequest, int>().Update(entity);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new ReopenVacancyRequestResponse
            {
                Id = entity.Id,
                Status = "Pending",
                DecidedBy = null,
                VacancyWithdrawn = withdrawn,
            };
        }

        // ==================================================================
        // Candidates / pipeline
        // ==================================================================

        public async Task<CandidateListResponse> GetCandidatesAsync(int? actorUserId, CandidateListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.view", null, cancellationToken);
            var gymIds = await ResolveGymScopeAsync(actor, null, cancellationToken);
            var gymNames = await ResolveGymNamesAsync(gymIds, cancellationToken);

            var stage = ParseStageOrNull(query.Stage);
            var page = Math.Max(query.Page, 1);
            var pageSize = NormalizePageSize(query.PageSize);
            var search = NullIfBlank(query.SearchTerm);
            var position = NullIfBlank(query.Position);
            var view = NullIfBlank(query.View)?.ToLowerInvariant();
            var descending = string.Equals(query.SortOrder, "desc", StringComparison.OrdinalIgnoreCase);

            var total = await _unitOfWork.GetRepository<Application, int>()
                .CountAsync(new ApplicationPipelineSpec(gymIds, gymNames, stage, position, view, query.Blocked, search, 0, 0, query.SortBy, descending), cancellationToken);
            var applications = await _unitOfWork.GetRepository<Application, int>()
                .GetAllAsync(new ApplicationPipelineSpec(gymIds, gymNames, stage, position, view, query.Blocked, search, (page - 1) * pageSize, pageSize, query.SortBy, descending), cancellationToken);
            var items = applications.Select(BuildCandidateItem).ToList();
            await AttachUserNamesAsync(items, applications, cancellationToken);

            return new CandidateListResponse
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<CandidateDataResponse> GetCandidateAsync(int? actorUserId, int candidateId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var candidate = await _unitOfWork.GetRepository<Candidate, int>()
                .GetByIdAsync(new CandidateByIdSpec(candidateId), cancellationToken)
                ?? throw new NotFoundException("Candidate not found.");

            var applications = (await _unitOfWork.GetRepository<Application, int>()
                    .GetAllAsync(new ApplicationsByCandidateSpec(candidateId), cancellationToken))
                .ToList();
            var latest = applications.FirstOrDefault();
            if (latest is null)
            {
                throw new NotFoundException("This candidate has no applications.");
            }

            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.view", await ApplicationGymIdAsync(latest, cancellationToken), cancellationToken);

            var item = BuildCandidateItem(latest);
            await AttachUserNamesAsync([item], applications, cancellationToken);
            return new CandidateDataResponse { Data = item };
        }

        public async Task<CandidateBlockResponse> SetCandidateBlockAsync(int? actorUserId, int candidateId, BlockCandidateRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var candidate = await _unitOfWork.GetRepository<Candidate, int>()
                .GetByIdAsync(new CandidateByIdSpec(candidateId), cancellationToken)
                ?? throw new NotFoundException("Candidate not found.");

            var latestGym = await LatestApplicationGymIdAsync(candidateId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.candidates.manage", latestGym, cancellationToken);

            candidate.Blocked = request.Blocked;
            candidate.BlockReason = request.Blocked ? NullIfBlank(request.BlockReason) : null;
            _unitOfWork.GetRepository<Candidate, int>().Update(candidate);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new CandidateBlockResponse
            {
                Id = candidate.Id,
                Blocked = candidate.Blocked,
                BlockReason = candidate.BlockReason,
            };
        }

        public async Task<ApplicationStageResponse> ChangeApplicationStageAsync(int? actorUserId, int applicationId, ChangeApplicationStageRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var application = await _unitOfWork.GetRepository<Application, int>()
                .GetByIdAsync(new ApplicationByIdSpec(applicationId), cancellationToken)
                ?? throw new NotFoundException("Application not found.");
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.candidates.manage", await ApplicationGymIdAsync(application, cancellationToken), cancellationToken);

            var stage = ParseStageOrNull(request.Stage)
                ?? throw new BadRequestException(
                    "Stage must be Applied, Screening, First Interview, Second Interview, Accepted, or Rejected.");

            if (stage == PipelineStageType.Hired)
            {
                // PROJECT.md rule 6: a candidate becomes an employee only through the
                // hire wizard, which creates the account + employee profile with it.
                throw new BadRequestException(
                    "Use the hire wizard (POST /api/applications/{id}/hire) to hire a candidate.");
            }

            var previous = application.CurrentStage;
            application.CurrentStage = stage;
            application.LastActivityAt = DateTime.UtcNow;

            if (stage == PipelineStageType.Rejected)
            {
                application.Status = ApplicationStatus.Rejected;
                application.RejectedAt ??= DateTime.UtcNow;
                application.RejectedBy ??= actor.Id;
            }
            else if (stage == PipelineStageType.Accepted)
            {
                application.DecisionBy = actor.Id;
                application.DecisionAt = DateTime.UtcNow;
            }

            await _unitOfWork.GetRepository<PipelineStage, int>().AddAsync(new PipelineStage
            {
                ApplicationId = application.Id,
                Stage = stage,
                EnteredDate = DateTime.UtcNow,
                ByUserId = actor.Id,
                Outcome = previous == stage ? null : $"Moved from {StageDisplay(previous)}",
            }, cancellationToken);
            _unitOfWork.GetRepository<Application, int>().Update(application);

            // Entering Second Interview without one schedules the round (the mock
            // seeds `{ date, by, type: "Panel", verdict: "Scheduled" }`).
            InterviewItem? scheduled = null;
            if (stage == PipelineStageType.SecondInterview &&
                !application.Interviews.Any(i => i.Stage == PipelineStageType.SecondInterview))
            {
                var interview = new Interview
                {
                    ApplicationId = application.Id,
                    Stage = PipelineStageType.SecondInterview,
                    ScheduledDate = DateTime.UtcNow.Date.AddDays(2).AddHours(10),
                    Type = "Panel",
                    Status = "Scheduled",
                    Verdict = "Scheduled",
                };
                await _unitOfWork.GetRepository<Interview, int>().AddAsync(interview, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                scheduled = BuildInterviewItem(interview);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new ApplicationStageResponse
            {
                Id = application.Id,
                Stage = StageDisplay(stage),
                Iv2 = scheduled,
            };
        }

        public async Task<CandidateListResponse> GetFollowUpsAsync(int? actorUserId, int page, int pageSize, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.view", null, cancellationToken);
            var gymIds = await ResolveGymScopeAsync(actor, null, cancellationToken);
            var gymNames = await ResolveGymNamesAsync(gymIds, cancellationToken);

            var safePage = Math.Max(page, 1);
            var safeSize = NormalizePageSize(pageSize);
            var staleBefore = DateTime.UtcNow.AddDays(-FollowUpStalenessDays);

            var total = await _unitOfWork.GetRepository<Application, int>()
                .CountAsync(new StaleApplicationsSpec(gymIds, gymNames, staleBefore, 0, 0), cancellationToken);
            var applications = await _unitOfWork.GetRepository<Application, int>()
                .GetAllAsync(new StaleApplicationsSpec(gymIds, gymNames, staleBefore, (safePage - 1) * safeSize, safeSize), cancellationToken);
            var items = applications.Select(BuildCandidateItem).ToList();
            await AttachUserNamesAsync(items, applications, cancellationToken);

            return new CandidateListResponse
            {
                Items = items,
                Page = safePage,
                PageSize = safeSize,
                Total = total,
                TotalPages = safeSize > 0 ? (int)Math.Ceiling(total / (double)safeSize) : 0,
            };
        }

        // ==================================================================
        // Interviews
        // ==================================================================

        public async Task<InterviewListResponse> GetInterviewsAsync(int? actorUserId, InterviewListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.view", null, cancellationToken);
            var gymIds = await ResolveGymScopeAsync(actor, null, cancellationToken);
            var gymNames = await ResolveGymNamesAsync(gymIds, cancellationToken);

            DateTime? from = null, to = null;
            if (DateTime.TryParseExact(query.Month, "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var month))
            {
                // Npgsql requires UTC for timestamptz parameters.
                from = DateTime.SpecifyKind(month, DateTimeKind.Utc);
                to = DateTime.SpecifyKind(month.AddMonths(1), DateTimeKind.Utc);
            }
            else if (DateOnly.TryParse(query.Date, out var day))
            {
                from = DateTime.SpecifyKind(day.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
                to = DateTime.SpecifyKind(day.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            }

            var page = Math.Max(query.Page, 1);
            var pageSize = NormalizePageSize(query.PageSize, 50);

            var total = await _unitOfWork.GetRepository<Interview, int>()
                .CountAsync(new InterviewListSpec(gymIds, gymNames, from, to, NullIfBlank(query.Status), query.CandidateId, 0, 0), cancellationToken);
            var interviews = await _unitOfWork.GetRepository<Interview, int>()
                .GetAllAsync(new InterviewListSpec(gymIds, gymNames, from, to, NullIfBlank(query.Status), query.CandidateId, (page - 1) * pageSize, pageSize), cancellationToken);
            var names = await LoadUserDisplayNamesAsync(interviews.Select(i => (int?)i.ConductedBy), cancellationToken);

            return new InterviewListResponse
            {
                Items = interviews.Select(i => BuildInterviewItem(i, names)).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<InterviewDataResponse> GetInterviewAsync(int? actorUserId, int interviewId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var interview = await _unitOfWork.GetRepository<Interview, int>()
                .GetByIdAsync(new InterviewByIdSpec(interviewId), cancellationToken)
                ?? throw new NotFoundException("Interview not found.");
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.view", await ApplicationGymIdAsync(interview.Application, cancellationToken), cancellationToken);

            var names = await LoadUserDisplayNamesAsync([(int?)interview.ConductedBy], cancellationToken);
            return new InterviewDataResponse { Data = BuildInterviewItem(interview, names) };
        }

        public async Task<InterviewDataResponse> CreateInterviewAsync(int? actorUserId, CreateInterviewRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);

            Application? application = null;
            if (request.CandidateId is int candidateId)
            {
                application = (await _unitOfWork.GetRepository<Application, int>()
                        .GetAllAsync(new ApplicationsByCandidateSpec(candidateId), cancellationToken))
                    .FirstOrDefault();
            }
            else if (NullIfBlank(request.Candidate) is string candidateLabel)
            {
                application = await ResolveApplicationByLabelAsync(candidateLabel, cancellationToken);
            }

            if (application is null)
            {
                throw new BadRequestException("Candidate is required (unknown candidate).");
            }

            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.candidates.manage", await ApplicationGymIdAsync(application, cancellationToken), cancellationToken);

            var date = DateOnly.TryParse(request.Date, out var parsedDate)
                ? parsedDate
                : DateOnly.FromDateTime(DateTime.UtcNow);
            var time = TimeOnly.TryParse(request.Time, out var parsedTime) ? parsedTime : new TimeOnly(10, 0);
            // Npgsql rejects Kind=Unspecified for timestamptz — treat the posted wall
            // clock time as UTC (the same convention as the stored event timestamps).
            var scheduledAt = DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Utc);

            // Default to the next interview round the application has not reached yet.
            var stage = application.Interviews.Any(i => i.Stage == PipelineStageType.FirstInterview)
                ? PipelineStageType.SecondInterview
                : PipelineStageType.FirstInterview;

            var (conductedBy, interviewerName) = await ResolveInterviewerAsync(request.Interviewer, cancellationToken);

            var interview = new Interview
            {
                ApplicationId = application.Id,
                Stage = stage,
                ScheduledDate = scheduledAt,
                Type = NullIfBlank(request.Type) ?? "On-site",
                Status = "Scheduled",
                Verdict = "Scheduled",
                Room = NullIfBlank(request.Room),
                ConductedBy = conductedBy,
                InterviewerName = interviewerName,
            };

            await _unitOfWork.GetRepository<Interview, int>().AddAsync(interview, cancellationToken);
            application.LastActivityAt = DateTime.UtcNow;
            _unitOfWork.GetRepository<Application, int>().Update(application);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var names = await LoadUserDisplayNamesAsync([(int?)interview.ConductedBy], cancellationToken);
            return new InterviewDataResponse { Data = BuildInterviewItem(interview, names) };
        }

        public async Task<InterviewDataResponse> CompleteInterviewAsync(int? actorUserId, int interviewId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var interview = await _unitOfWork.GetRepository<Interview, int>()
                .GetByIdAsync(new InterviewByIdSpec(interviewId), cancellationToken)
                ?? throw new NotFoundException("Interview not found.");
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.candidates.manage", await ApplicationGymIdAsync(interview.Application, cancellationToken), cancellationToken);

            interview.Status = "Completed";
            interview.CompletedAt ??= DateTime.UtcNow;
            interview.Application.LastActivityAt = DateTime.UtcNow;
            _unitOfWork.GetRepository<Interview, int>().Update(interview);
            _unitOfWork.GetRepository<Application, int>().Update(interview.Application);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var names = await LoadUserDisplayNamesAsync([(int?)interview.ConductedBy], cancellationToken);
            return new InterviewDataResponse { Data = BuildInterviewItem(interview, names) };
        }

        public async Task<ReminderResponse> SendInterviewReminderAsync(int? actorUserId, int interviewId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var interview = await _unitOfWork.GetRepository<Interview, int>()
                .GetByIdAsync(new InterviewByIdSpec(interviewId), cancellationToken)
                ?? throw new NotFoundException("Interview not found.");
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.candidates.manage", await ApplicationGymIdAsync(interview.Application, cancellationToken), cancellationToken);

            if (interview.ConductedBy is int interviewerId)
            {
                await _unitOfWork.GetRepository<Notification, int>().AddAsync(new Notification
                {
                    UserId = interviewerId,
                    Title = "Interview reminder",
                    Message = $"Interview with {interview.Application.Candidate.FullName} on {interview.ScheduledDate:yyyy-MM-dd} at {interview.ScheduledDate:HH:mm}.",
                    Type = NotificationType.RecruitmentFollowUp,
                    LinkTo = "recruitment",
                }, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return new ReminderResponse { Message = "Reminder sent." };
        }

        // ==================================================================
        // Waiting list
        // ==================================================================

        public async Task<WaitingListResponse> GetWaitingListAsync(int? actorUserId, WaitingListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.view", null, cancellationToken);
            var gymIds = await ResolveGymScopeAsync(actor, null, cancellationToken);
            var gymNames = await ResolveGymNamesAsync(gymIds, cancellationToken);

            var page = Math.Max(query.Page, 1);
            var pageSize = NormalizePageSize(query.PageSize);
            var position = NullIfBlank(query.Position);

            var total = await _unitOfWork.GetRepository<Application, int>()
                .CountAsync(new WaitingListApplicationsSpec(gymIds, gymNames, position, 0, 0), cancellationToken);
            var waiting = (await _unitOfWork.GetRepository<Application, int>()
                    .GetAllAsync(new WaitingListApplicationsSpec(gymIds, gymNames, position, (page - 1) * pageSize, pageSize), cancellationToken))
                .ToList();

            // Partial position match against open vacancies (the mock's _matchingVacancies).
            var openVacancies = (await _unitOfWork.GetRepository<Vacancy, int>()
                    .GetAllAsync(new OpenVacanciesSpec(gymIds), cancellationToken))
                .ToList();

            var items = waiting.Select(a =>
            {
                var candidatePosition = a.Vacancy?.Position?.Title ?? a.Vacancy?.Title ?? a.PositionTitle ?? string.Empty;
                var matches = openVacancies
                    .Where(v => PositionMatches(candidatePosition, v.Title))
                    .Select(v => new WaitingMatchItem
                    {
                        Id = v.Id,
                        Position = v.Title,
                        Gym = v.Gym?.Name,
                        Headcount = v.HeadcountNeeded,
                        Urgency = v.Urgency,
                        Candidates = v.Applications.Count,
                    })
                    .ToList();

                return new WaitingListItem
                {
                    Id = a.Id,
                    CandidateId = a.CandidateId,
                    Name = a.Candidate.FullName,
                    Position = candidatePosition,
                    Skills = ParseJsonStringArray(a.Candidate.SkillsJson),
                    Note = a.Notes,
                    Since = a.AppliedDate,
                    Source = a.Source,
                    MatchingVacancies = matches,
                };
            }).ToList();

            return new WaitingListResponse
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<AssignWaitingDataResponse> AssignWaitingCandidateAsync(int? actorUserId, int applicationId, AssignWaitingRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var application = await _unitOfWork.GetRepository<Application, int>()
                .GetByIdAsync(new ApplicationByIdSpec(applicationId), cancellationToken)
                ?? throw new NotFoundException("Waiting-list entry not found.");
            if (application.Status != ApplicationStatus.WaitingList)
            {
                throw new BadRequestException("This entry is not on the waiting list.");
            }

            var hireRequest = new HireApplicationRequest
            {
                Gym = request.Gym,
                GymId = request.GymId,
                Salary = request.Salary,
                AnnualIncrease = request.AnnualIncrease,
                LeaveDays = request.LeaveDays,
                StartDate = request.StartDate,
                Level = request.Level,
                Email = request.Email,
                Password = request.Password,
                Role = request.Role,
                VacancyId = request.VacancyId,
            };

            var hire = await HireCoreAsync(actor, application, hireRequest, cancellationToken);
            return new AssignWaitingDataResponse
            {
                Data = new AssignWaitingResponse
                {
                    EmployeeId = hire.EmployeeId,
                    Name = hire.Name,
                    Position = hire.Position,
                    Level = hire.Level,
                    Gym = hire.Gym,
                    StartDate = hire.StartDate,
                    WaitingListRemoved = true,
                    NewComerId = hire.NewComerId,
                },
            };
        }

        public async Task RemoveFromWaitingListAsync(int? actorUserId, int applicationId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var application = await _unitOfWork.GetRepository<Application, int>()
                .GetByIdAsync(new ApplicationByIdSpec(applicationId), cancellationToken)
                ?? throw new NotFoundException("Waiting-list entry not found.");
            if (application.Status != ApplicationStatus.WaitingList)
            {
                throw new BadRequestException("This entry is not on the waiting list.");
            }

            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.candidates.manage", await ApplicationGymIdAsync(application, cancellationToken), cancellationToken);

            _unitOfWork.GetRepository<Application, int>().Remove(application);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // ==================================================================
        // Public hiring-form applications (api-spec-from-ui.md §5.2)
        // ==================================================================

        /// <summary>Stored JSON (answers + careers extras) uses camelCase keys like every other payload.</summary>
        private static readonly JsonSerializerOptions JsonStore = new(JsonSerializerDefaults.Web);

        public async Task<SubmitFormApplicationResponse> SubmitFormApplicationAsync(SubmitFormApplicationRequest request, CancellationToken cancellationToken = default)
        {
            if (request.FormId is not int formId)
            {
                throw new BadRequestException("A formId is required.");
            }

            var form = await _unitOfWork.GetRepository<HiringForm, int>()
                .GetByIdAsync(new HiringFormByIdSpec(formId), cancellationToken)
                ?? throw new NotFoundException("Hiring form not found.");

            if (!string.Equals(form.Status, "Open", StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestException("This form is no longer accepting applications.");
            }

            var name = NullIfBlank(request.Name)
                ?? throw new BadRequestException("Name is required.");
            var email = NullIfBlank(request.Email)
                ?? throw new BadRequestException("Email is required.");
            if (!email.Contains('@'))
            {
                throw new BadRequestException("Enter a valid email address.");
            }

            // The pipeline Block action gates re-applications (§5.1.3).
            var candidates = await _unitOfWork.GetRepository<Candidate, int>()
                .GetAllAsync(new CandidateByEmailSpec(email), cancellationToken);
            if (candidates.Any(c => c.Blocked))
            {
                throw new BadRequestException("This email address has been blocked from applying.");
            }

            var hasCareers = request.Source is not null || request.ExpYears is not null || request.Education is not null
                || request.Skills is not null || request.Languages is not null || request.Shift is not null
                || request.SalaryExp is not null || request.Availability is not null;

            var application = new HiringFormApplication
            {
                HiringFormId = form.Id,
                Name = name,
                Email = email,
                Phone = NullIfBlank(request.Phone) ?? string.Empty,
                Gym = NullIfBlank(request.GymPref) ?? NullIfBlank(request.Gym),
                Position = NullIfBlank(request.Position),
                AnswersJson = JsonSerializer.Serialize(request.Answers ?? [], JsonStore),
                CareersJson = hasCareers
                    ? JsonSerializer.Serialize(new FormApplicationCareers
                    {
                        Source = NullIfBlank(request.Source),
                        ExpYears = request.ExpYears,
                        Education = NullIfBlank(request.Education),
                        Skills = request.Skills,
                        Languages = request.Languages,
                        Shift = NullIfBlank(request.Shift),
                        SalaryExp = request.SalaryExp,
                        Availability = NullIfBlank(request.Availability),
                    }, JsonStore)
                    : null,
            };

            await _unitOfWork.GetRepository<HiringFormApplication, int>().AddAsync(application, cancellationToken);

            form.LastUsedAt = DateTime.UtcNow;
            _unitOfWork.GetRepository<HiringForm, int>().Update(form);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new SubmitFormApplicationResponse { Message = "Application submitted." };
        }

        public async Task<FormApplicationListResponse> GetFormApplicationsAsync(int? actorUserId, FormApplicationListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "recruitment.candidates.manage", cancellationToken);
            var scope = await ResolveGymScopeAsync(actor, null, cancellationToken);
            var scopeNames = await ResolveGymNamesAsync(scope, cancellationToken);

            var page = Math.Max(query.Page, 1);
            var pageSize = NormalizePageSize(query.PageSize);
            var formId = query.FormId;
            var status = NullIfBlank(query.Status);
            var search = NullIfBlank(query.SearchTerm);

            var total = await _unitOfWork.GetRepository<HiringFormApplication, int>()
                .CountAsync(new FormApplicationListSpec(scope, scopeNames, formId, status, search, 0, 0), cancellationToken);
            var rows = (await _unitOfWork.GetRepository<HiringFormApplication, int>()
                    .GetAllAsync(new FormApplicationListSpec(scope, scopeNames, formId, status, search, (page - 1) * pageSize, pageSize), cancellationToken))
                .ToList();

            return new FormApplicationListResponse
            {
                Items = rows.Select(MapFormApplication).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<FormApplicationDetailResponse> GetFormApplicationAsync(int? actorUserId, int applicationId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var row = await _unitOfWork.GetRepository<HiringFormApplication, int>()
                .GetByIdAsync(new FormApplicationByIdSpec(applicationId), cancellationToken)
                ?? throw new NotFoundException("Application not found.");
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.candidates.manage", await PreferredGymIdAsync(row.Gym, cancellationToken), cancellationToken);

            return new FormApplicationDetailResponse { Data = MapFormApplication(row) };
        }

        public async Task<RejectFormApplicationResponse> RejectFormApplicationAsync(int? actorUserId, int applicationId, RejectFormApplicationRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var row = await _unitOfWork.GetRepository<HiringFormApplication, int>()
                .GetByIdAsync(new FormApplicationByIdSpec(applicationId), cancellationToken)
                ?? throw new NotFoundException("Application not found.");
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.candidates.manage", await PreferredGymIdAsync(row.Gym, cancellationToken), cancellationToken);

            if (row.CandidateId is not null)
            {
                throw new BadRequestException("This applicant is already in the pipeline.");
            }

            row.Status = "Rejected";
            row.RejectComment = NullIfBlank(request.Comment);
            _unitOfWork.GetRepository<HiringFormApplication, int>().Update(row);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new RejectFormApplicationResponse
            {
                Data = new IdStatusData { Id = row.Id, Status = row.Status },
            };
        }

        public async Task<ConvertToCandidateResponse> ConvertApplicationToCandidateAsync(int? actorUserId, ConvertToCandidateRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            if (request.ApplicationId is not int applicationId)
            {
                throw new BadRequestException("An applicationId is required.");
            }

            var row = await _unitOfWork.GetRepository<HiringFormApplication, int>()
                .GetByIdAsync(new FormApplicationByIdSpec(applicationId), cancellationToken)
                ?? throw new NotFoundException("Application not found.");
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.candidates.manage", await PreferredGymIdAsync(row.Gym, cancellationToken), cancellationToken);

            if (row.CandidateId is not null)
            {
                throw new BadRequestException("This applicant is already in the pipeline.");
            }

            var careers = DeserializeCareers(row.CareersJson);
            var formName = row.HiringForm.Name;

            // One save: the candidate, its vacancy-less pipeline application (Applied),
            // and the applicant row flipped to "Moved to Pipeline".
            var candidate = new Candidate
            {
                FullName = row.Name,
                Email = row.Email,
                Phone = row.Phone,
                DateOfBirth = default,          // unknown for anonymous applicants — collected during hiring
                NationalId = string.Empty,
                SkillsJson = careers?.Skills is { Count: > 0 } skills
                    ? JsonSerializer.Serialize(skills, JsonStore)
                    : null,
            };
            var application = new Application
            {
                Candidate = candidate,
                VacancyId = null,
                PositionTitle = NullIfBlank(row.Position) ?? NullIfBlank(row.HiringForm.Position),
                AppliedDate = row.AppliedDate,
                LastActivityAt = DateTime.UtcNow,
                CurrentStage = PipelineStageType.Applied,
                Status = ApplicationStatus.InProgress,
                Source = NullIfBlank(careers?.Source) ?? $"Hiring Form — {formName}",
                PreferredGym = row.Gym,
                ExperienceYears = careers?.ExpYears ?? 0,
                Education = careers?.Education ?? string.Empty,
                LanguagesJson = JsonSerializer.Serialize(careers?.Languages ?? [], JsonStore),
                ShiftPreference = careers?.Shift ?? "Any",
                SalaryExpectation = careers?.SalaryExp ?? 0,
                Availability = careers?.Availability ?? "Immediate",
            };

            await _unitOfWork.GetRepository<Candidate, int>().AddAsync(candidate, cancellationToken);
            await _unitOfWork.GetRepository<Application, int>().AddAsync(application, cancellationToken);

            row.Candidate = candidate;
            row.Status = "Moved to Pipeline";
            _unitOfWork.GetRepository<HiringFormApplication, int>().Update(row);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var item = BuildCandidateItem(application);
            item.Rating ??= 0m;                 // spec: new candidates show rating 0, not null
            return new ConvertToCandidateResponse { Data = item, ApplicationStatus = row.Status };
        }

        private static FormApplicationItem MapFormApplication(HiringFormApplication row)
        {
            List<FormApplicationAnswer> answers;
            try
            {
                answers = JsonSerializer.Deserialize<List<FormApplicationAnswer>>(row.AnswersJson, JsonStore) ?? [];
            }
            catch (JsonException)
            {
                answers = [];
            }

            return new FormApplicationItem
            {
                Id = row.Id,
                Name = row.Name,
                Email = row.Email,
                Phone = row.Phone,
                Gym = row.Gym,
                FormId = row.HiringFormId,
                FormName = row.HiringForm?.Name ?? string.Empty,
                Position = NullIfBlank(row.Position) ?? row.HiringForm?.Position,
                AppliedDate = row.AppliedDate,
                Status = row.Status,
                RejectComment = row.RejectComment,
                Answers = answers,
            };
        }

        private static FormApplicationCareers? DeserializeCareers(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<FormApplicationCareers>(json, JsonStore);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        // ==================================================================
        // Hire wizard
        // ==================================================================

        public async Task<HireDataResponse> HireCandidateAsync(int? actorUserId, int applicationId, HireApplicationRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var application = await _unitOfWork.GetRepository<Application, int>()
                .GetByIdAsync(new ApplicationByIdSpec(applicationId), cancellationToken)
                ?? throw new NotFoundException("Application not found.");

            var hire = await HireCoreAsync(actor, application, request, cancellationToken);
            return new HireDataResponse { Data = hire };
        }

        /// <summary>
        /// The single Hired transition (PROJECT.md rule 6): creates the User account +
        /// Employee profile (application/interview data carried), links the candidate,
        /// grants gym access, records compensation + history + the onboarding checklist,
        /// decrements (and closes at 0) the vacancy headcount, and audit-logs the hire.
        /// </summary>
        private async Task<HireResponse> HireCoreAsync(User actor, Application application, HireApplicationRequest request, CancellationToken cancellationToken)
        {
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.hire.approve", await ApplicationGymIdAsync(application, cancellationToken), cancellationToken);

            if (application.Status == ApplicationStatus.Hired)
            {
                throw new BadRequestException("This candidate has already been hired.");
            }

            if (application.Candidate.Blocked)
            {
                throw new BadRequestException("This candidate is blocked. Restore them to the pipeline first.");
            }

            var gym = await ResolveGymAsync(actor, request.GymId, request.Gym, application.Vacancy?.GymId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.hire.approve", gym.Id, cancellationToken);

            var candidate = application.Candidate;
            var email = (NullIfBlank(request.Email) ?? candidate.Email).Trim().ToLowerInvariant();
            if (await _unitOfWork.GetRepository<User, int>().GetByIdAsync(new UserByEmailSpec(email), cancellationToken) is not null)
            {
                throw new BadRequestException($"Email '{email}' is already in use.");
            }

            var positionTitle = application.Vacancy?.Title ?? application.PositionTitle
                ?? throw new BadRequestException("This application carries no position — provide one to hire.");
            var position = await ResolvePositionAsync(gym.Id, positionTitle, cancellationToken);
            var level = NullIfBlank(request.Level) ?? "1";
            var startDate = DateOnly.TryParse(request.StartDate, out var parsedStart)
                ? parsedStart
                : DateOnly.FromDateTime(DateTime.UtcNow);

            var user = new User
            {
                UserName = email,
                Email = email,
                PasswordHash = _passwordHasher.Hash(NullIfBlank(request.Password) ?? DefaultNewAccountPassword),
                UserType = UserType.Employee,
                IsActive = true,
            };
            await _unitOfWork.GetRepository<User, int>().AddAsync(user, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var employee = new Employee
            {
                UserId = user.Id,
                GymId = gym.Id,
                PositionId = position.Id,
                CandidateId = candidate.Id,
                FullName = candidate.FullName,
                Phone = NullIfBlank(candidate.Phone),
                DateOfBirth = candidate.DateOfBirth,
                NationalId = NullIfBlank(candidate.NationalId),
                EmployeeNumber = await GenerateEmployeeNumberAsync(cancellationToken),
                HireDate = DateOnly.FromDateTime(DateTime.UtcNow),
                Status = EmployeeStatus.Active,
                ContractType = NullIfBlank(request.ContractType) ?? "Full-time",
                ContractStartDate = startDate,
            };
            await _unitOfWork.GetRepository<Employee, int>().AddAsync(employee, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await _userAccess.AddGymAccessAsync(user.Id, gym.Id, cancellationToken);

            if (request.Salary is decimal salary)
            {
                await _unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Compensation, int>().AddAsync(
                    new DomainLayer.Models.EmployeeModule.Compensation
                    {
                        EmployeeId = employee.Id,
                        Amount = salary,
                        EffectiveDate = startDate,
                        ChangedBy = actor.Id,
                        Reason = "Hire (recruitment)",
                    }, cancellationToken);
            }

            await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(new EmploymentHistory
            {
                EmployeeId = employee.Id,
                EffectiveDate = employee.HireDate,
                ChangeType = EmploymentChangeType.Hire,
                OldValueJson = JsonSerializer.Serialize(string.Empty),
                NewValueJson = JsonSerializer.Serialize($"Joined {gym.Name} as {position.Title} (Level {level})"),
                Reason = "Hired from recruitment",
                ChangedBy = actor.Id,
            }, cancellationToken);

            // System role from the wizard, when one resolves by name.
            string? assignedRole = null;
            if (NullIfBlank(request.Role) is string roleName)
            {
                var role = (await _unitOfWork.GetRepository<Role, int>()
                        .GetAllAsync(new RoleByNameSpec(roleName), cancellationToken))
                    .FirstOrDefault();
                if (role is null)
                {
                    throw new BadRequestException($"Unknown system role '{roleName}'. Create it under Roles & Permissions first.");
                }

                await _userAccess.ReplaceUserRolesAsync(user.Id, [role.Id], cancellationToken);
                assignedRole = role.Name;
            }

            // Onboarding checklist (New Comers tab).
            for (var i = 0; i < DefaultOnboardingChecklist.Length; i++)
            {
                await _unitOfWork.GetRepository<OnboardingChecklistItem, int>().AddAsync(new OnboardingChecklistItem
                {
                    EmployeeId = employee.Id,
                    Title = DefaultOnboardingChecklist[i],
                    SortOrder = i,
                }, cancellationToken);
            }

            // Application → Hired.
            application.Status = ApplicationStatus.Hired;
            application.CurrentStage = PipelineStageType.Hired;
            application.HiredDate = DateTime.UtcNow;
            application.HiredBy = actor.Id;
            application.DecisionBy ??= actor.Id;
            application.DecisionAt ??= DateTime.UtcNow;
            application.DecisionNote = NullIfBlank(request.OfferLetterNote) ?? application.DecisionNote;
            application.LastActivityAt = DateTime.UtcNow;
            _unitOfWork.GetRepository<Application, int>().Update(application);

            await _unitOfWork.GetRepository<PipelineStage, int>().AddAsync(new PipelineStage
            {
                ApplicationId = application.Id,
                Stage = PipelineStageType.Hired,
                EnteredDate = DateTime.UtcNow,
                CompletedDate = DateTime.UtcNow,
                ByUserId = actor.Id,
                Outcome = "Hired",
            }, cancellationToken);

            // Vacancy headcount decrement; closed at zero. Vacancy-less applications
            // (hiring-form conversions) have no posting to decrement.
            var vacancy = application.Vacancy;
            if (vacancy is not null)
            {
                vacancy.HeadcountNeeded = Math.Max(vacancy.HeadcountNeeded - 1, 0);
                if (vacancy.HeadcountNeeded == 0)
                {
                    vacancy.Status = VacancyStatus.Closed;
                }

                _unitOfWork.GetRepository<Vacancy, int>().Update(vacancy);
            }

            await _unitOfWork.GetRepository<AuditLog, int>().AddAsync(new AuditLog
            {
                UserId = actor.Id,
                Action = "Employee Hired from Recruitment",
                EntityType = "Employee",
                EntityId = employee.Id,
                NewValues = JsonSerializer.Serialize(new
                {
                    candidateId = candidate.Id,
                    applicationId = application.Id,
                    vacancyId = vacancy?.Id,
                    gym = gym.Name,
                    position = position.Title,
                    email,
                }),
            }, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new HireResponse
            {
                EmployeeId = employee.Id,
                NewComerId = employee.Id,
                Name = employee.FullName,
                Position = position.Title,
                Level = level,
                Gym = gym.Name,
                Status = "Active",
                StartDate = startDate.ToString("yyyy-MM-dd"),
                Email = email,
                Salary = request.Salary,
                LeaveDays = request.LeaveDays,
                Role = assignedRole,
                HiredDate = application.HiredDate,
                VacancyHeadcountRemaining = vacancy?.HeadcountNeeded ?? 0,
            };
        }

        // ==================================================================
        // New Comers / onboarding
        // ==================================================================

        public async Task<NewComerListResponse> GetNewComersAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var gymIds = await ResolveGymScopeAsync(actor, null, cancellationToken);

            // Matrix row 44: the check is per gym of the resolved scope (a Branch
            // Manager holds recruitment.view as a per-gym role key, so a null-gym
            // global check would wrongly hide the queue from him). No accessible
            // gym means nothing to check against — deny like any unscoped caller.
            if (gymIds.Length == 0 && actor.UserType != UserType.TopManagement)
            {
                throw new UnAuthorizedException("You do not have permission to perform this action.");
            }

            foreach (var gymId in gymIds)
            {
                await _accessControl.EnsurePermissionForGymAsync(actor.Id, "recruitment.view", gymId, cancellationToken);
            }

            var cutoff = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-NewComerLookbackDays);
            var employees = await _unitOfWork.GetRepository<Employee, int>()
                .GetAllAsync(new NewComersSpec(gymIds, cutoff), cancellationToken);

            return new NewComerListResponse
            {
                Items = employees.Select(e =>
                {
                    var checklist = e.OnboardingChecklistItems
                        .OrderBy(i => i.SortOrder)
                        .ThenBy(i => i.Id)
                        .Select(i => new ChecklistEntry(i.Title, i.IsCompleted))
                        .ToList();
                    var done = checklist.Count(c => c.Done);
                    return new NewComerItem
                    {
                        Id = e.Id,
                        Name = e.FullName,
                        Initials = BuildInitials(e.FullName),
                        Position = e.Position?.Title,
                        StartDate = e.ContractStartDate.ToString("yyyy-MM-dd"),
                        Progress = checklist.Count == 0 ? 100 : (int)Math.Round(done * 100d / checklist.Count),
                        Checklist = checklist,
                    };
                }).ToList(),
            };
        }

        public async Task<OnboardingChecklistResponse> UpdateOnboardingChecklistAsync(int? actorUserId, int employeeId, OnboardingChecklistRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var employee = await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, "recruitment.hire.approve", employee.GymId, cancellationToken);

            var items = (await _unitOfWork.GetRepository<OnboardingChecklistItem, int>()
                    .GetAllAsync(new OnboardingItemsSpec(employeeId), cancellationToken))
                .ToList();

            if (request.Checklist is { Count: > 0 } batch)
            {
                foreach (var (label, done) in batch)
                {
                    var item = items.FirstOrDefault(i =>
                        string.Equals(i.Title.Trim(), label.Trim(), StringComparison.OrdinalIgnoreCase));
                    if (item is null)
                    {
                        item = new OnboardingChecklistItem
                        {
                            EmployeeId = employeeId,
                            Title = label.Trim(),
                            SortOrder = items.Count,
                        };
                        items.Add(item);
                        await _unitOfWork.GetRepository<OnboardingChecklistItem, int>().AddAsync(item, cancellationToken);
                    }

                    SetChecklistState(item, done, actor.Id);
                }
            }
            else if (NullIfBlank(request.Item) is string title)
            {
                var item = items.FirstOrDefault(i =>
                    string.Equals(i.Title.Trim(), title.Trim(), StringComparison.OrdinalIgnoreCase))
                    ?? throw new BadRequestException($"Unknown checklist item '{title}'.");
                SetChecklistState(item, request.Done ?? true, actor.Id);
            }
            else
            {
                throw new BadRequestException("Provide 'item' + 'done' (single toggle) or a 'checklist' array.");
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var saved = (await _unitOfWork.GetRepository<OnboardingChecklistItem, int>()
                    .GetAllAsync(new OnboardingItemsSpec(employeeId), cancellationToken))
                .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
                .Select(i => new ChecklistEntry(i.Title, i.IsCompleted))
                .ToList();
            var completed = saved.Count(c => c.Done);

            return new OnboardingChecklistResponse
            {
                Data = new OnboardingChecklistData
                {
                    Id = employeeId,
                    Progress = saved.Count == 0 ? 100 : (int)Math.Round(completed * 100d / saved.Count),
                    Checklist = saved,
                },
            };
        }

        // ==================================================================
        // Shared helpers
        // ==================================================================

        private static void SetChecklistState(OnboardingChecklistItem item, bool done, int actorId)
        {
            item.IsCompleted = done;
            if (done)
            {
                item.CompletedAt ??= DateTime.UtcNow;
                item.CompletedBy ??= actorId;
            }
            else
            {
                item.CompletedAt = null;
                item.CompletedBy = null;
            }
        }

        private async Task<User> ResolveActorAsync(int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null or <= 0)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var actor = await _unitOfWork.GetRepository<User, int>().GetByIdAsync(actorUserId.Value, cancellationToken);
            if (actor is null || !actor.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            return actor;
        }

        /// <summary>null = unrestricted (Top Management without a gym filter); empty array = matches nobody.</summary>
        private async Task<int[]> ResolveGymScopeAsync(User actor, int? requestedGym, CancellationToken cancellationToken)
        {
            if (actor.UserType == UserType.TopManagement)
            {
                return requestedGym.HasValue ? [requestedGym.Value] : [];
            }

            var allowedIds = (await _userAccess.GetGymAccessAsync(actor.Id, cancellationToken))
                .Select(a => a.GymId)
                .ToHashSet();
            if (requestedGym.HasValue)
            {
                if (!allowedIds.Contains(requestedGym.Value))
                {
                    throw new UnAuthorizedException("You are not assigned to this gym.");
                }

                return [requestedGym.Value];
            }

            return allowedIds.ToArray();
        }

        /// <summary>
        /// Gym display names for a resolved scope. Vacancy-less applications (converted
        /// hiring-form submissions) carry a typed branch name instead of a GymId, so the
        /// list specs match those against the scope's names.
        /// </summary>
        private async Task<string[]> ResolveGymNamesAsync(int[] gymIds, CancellationToken cancellationToken)
        {
            if (gymIds.Length == 0)
            {
                return [];
            }

            var gyms = await _unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken);
            return gyms
                .Where(g => gymIds.Contains(g.Id))
                .Select(g => g.Name)
                .ToArray();
        }

        /// <summary>
        /// Resolves the target gym of a write by id or name (the UI sends names).
        /// Non-Top-Management actors can only target gyms they are assigned to.
        /// </summary>
        private async Task<Gym> ResolveGymAsync(User actor, int? gymId, string? gymName, CancellationToken cancellationToken)
        {
            if (actor.UserType == UserType.TopManagement && gymId is null && NullIfBlank(gymName) is null)
            {
                throw new BadRequestException("Gym is required.");
            }

            Gym? gym;
            if (gymId is int id)
            {
                gym = await _unitOfWork.GetRepository<Gym, int>().GetByIdAsync(id, cancellationToken);
            }
            else if (NullIfBlank(gymName) is string name)
            {
                var gyms = await _unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken);
                gym = gyms.FirstOrDefault(g => string.Equals(g.Name.Trim(), name, StringComparison.OrdinalIgnoreCase));
            }
            else
            {
                throw new BadRequestException("Gym is required.");
            }

            if (gym is null)
            {
                throw new BadRequestException("Unknown gym.");
            }

            if (actor.UserType != UserType.TopManagement &&
                !await _userAccess.HasGymAccessAsync(actor.Id, gym.Id, cancellationToken))
            {
                throw new UnAuthorizedException("You are not assigned to this gym.");
            }

            return gym;
        }

        /// <summary>Optional-gym overload: falls back to the default gym when neither id nor name is given (vacancy-less applications have no branch — then the base rules apply).</summary>
        private async Task<Gym> ResolveGymAsync(User actor, int? gymId, string? gymName, int? defaultGymId, CancellationToken cancellationToken)
        {
            if (gymId is null && NullIfBlank(gymName) is null && defaultGymId is int fallback)
            {
                return await _unitOfWork.GetRepository<Gym, int>().GetByIdAsync(fallback, cancellationToken)
                    ?? throw new NotFoundException("Gym not found.");
            }

            return await ResolveGymAsync(actor, gymId, gymName, cancellationToken);
        }

        /// <summary>Title match (any level) in the gym's catalog, else creates one at level 1.</summary>
        private async Task<Position> ResolvePositionAsync(int gymId, string title, CancellationToken cancellationToken)
        {
            var clean = title.Trim();
            var catalog = await _unitOfWork.GetRepository<Position, int>()
                .GetAllAsync(new GymPositionsSpec(gymId), cancellationToken);
            var match = catalog.FirstOrDefault(p =>
                string.Equals(p.Title.Trim(), clean, StringComparison.OrdinalIgnoreCase));
            if (match is not null)
            {
                return match;
            }

            var position = new Position { GymId = gymId, Title = clean, Level = "1" };
            await _unitOfWork.GetRepository<Position, int>().AddAsync(position, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return position;
        }

        /// <summary>Resolves the interviewer label to a system user (by email or username) when possible.</summary>
        private async Task<(int? ConductedBy, string? InterviewerName)> ResolveInterviewerAsync(string? interviewer, CancellationToken cancellationToken)
        {
            var label = NullIfBlank(interviewer);
            if (label is null)
            {
                return (null, null);
            }

            var users = await _unitOfWork.GetRepository<User, int>().GetAllAsync(cancellationToken);
            var user = users.FirstOrDefault(u =>
                string.Equals(u.Email.Trim(), label, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(u.UserName.Trim(), label, StringComparison.OrdinalIgnoreCase));

            return user is null ? (null, label) : (user.Id, null);
        }

        /// <summary>"Karim Hassan — Fitness Trainer" (or a bare name) → the candidate's latest application.</summary>
        private async Task<Application?> ResolveApplicationByLabelAsync(string label, CancellationToken cancellationToken)
        {
            var namePart = label.Split(['—', '-'], 2, StringSplitOptions.TrimEntries)[0].Trim().ToLower();
            var candidates = await _unitOfWork.GetRepository<Candidate, int>().GetAllAsync(cancellationToken);
            var matches = candidates
                .Where(c => string.Equals(c.FullName.Trim().ToLower(), namePart, StringComparison.OrdinalIgnoreCase))
                .Select(c => c.Id)
                .ToList();
            if (matches.Count != 1)
            {
                return null;
            }

            return (await _unitOfWork.GetRepository<Application, int>()
                    .GetAllAsync(new ApplicationsByCandidateSpec(matches[0]), cancellationToken))
                .FirstOrDefault();
        }

        /// <summary>The gym of a candidate's latest application (block/restore guard).</summary>
        private async Task<int> LatestApplicationGymIdAsync(int candidateId, CancellationToken cancellationToken)
        {
            var latest = (await _unitOfWork.GetRepository<Application, int>()
                    .GetAllAsync(new ApplicationsByCandidateSpec(candidateId), cancellationToken))
                .FirstOrDefault();
            if (latest is null)
            {
                return 0;
            }

            return await ApplicationGymIdAsync(latest, cancellationToken) ?? 0;
        }

        /// <summary>EMP-#### from the highest existing numeric suffix, floored at 1001 (EmployeeService parity).</summary>
        private async Task<string> GenerateEmployeeNumberAsync(CancellationToken cancellationToken)
        {
            var employees = await _unitOfWork.GetRepository<Employee, int>().GetAllAsync(cancellationToken);
            var max = employees
                .Where(e => e.EmployeeNumber.StartsWith("EMP-", StringComparison.Ordinal))
                .Select(e => int.TryParse(e.EmployeeNumber["EMP-".Length..], out var n) ? n : 0)
                .DefaultIfEmpty(1000)
                .Max();
            return $"EMP-{Math.Max(max + 1, 1001)}";
        }

        /// <summary>Batch-loads display names for every user id a page of items references.</summary>
        private async Task<Dictionary<int, string>> LoadUserDisplayNamesAsync(IEnumerable<int?> userIds, CancellationToken cancellationToken)
        {
            var ids = userIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
            if (ids.Count == 0)
            {
                return [];
            }

            var users = new List<User>();
            foreach (var id in ids)
            {
                var user = await _unitOfWork.GetRepository<User, int>().GetByIdAsync(id, cancellationToken);
                if (user is not null)
                {
                    users.Add(user);
                }
            }

            return users.ToDictionary(u => u.Id, u => DisplayName(u));
        }

        /// <summary>Fills RejectedBy / DecisionBy / iv1.iv2 interviewer names on a page of candidate items.</summary>
        private async Task AttachUserNamesAsync(List<CandidateItem> items, IEnumerable<Application> applications, CancellationToken cancellationToken)
        {
            var ids = applications.SelectMany(a => new[]
            {
                (int?)a.RejectedBy, a.DecisionBy, a.HiredBy,
            }).Concat(applications.SelectMany(a => a.Interviews).Select(i => (int?)i.ConductedBy))
              .Concat(applications.SelectMany(a => a.PipelineStages).Select(s => s.ByUserId));

            var names = await LoadUserDisplayNamesAsync(ids, cancellationToken);
            foreach (var item in items)
            {
                if (item.RejectedBy is string rejectedBy && int.TryParse(rejectedBy, out var rejectedId))
                {
                    item.RejectedBy = names.GetValueOrDefault(rejectedId);
                }

                if (item.Decision?.By is string decidedBy && int.TryParse(decidedBy, out var decidedId))
                {
                    item.Decision.By = names.GetValueOrDefault(decidedId);
                }

                foreach (var block in new[] { item.Iv1, item.Iv2 })
                {
                    if (block?.By is string by && int.TryParse(by, out var interviewerId))
                    {
                        block.By = names.GetValueOrDefault(interviewerId);
                    }
                }
            }
        }

        // ==================================================================
        // Builders & parsers
        // ==================================================================

        private VacancyItem BuildVacancyItem(Vacancy vacancy, IReadOnlyDictionary<int, string> userNames) => new()
        {
            Id = vacancy.Id,
            PositionId = vacancy.PositionId,
            Position = vacancy.Title,
            GymId = vacancy.GymId,
            Gym = vacancy.Gym?.Name ?? string.Empty,
            Headcount = vacancy.HeadcountNeeded,
            Urgency = vacancy.Urgency,
            Status = VacancyStatusDisplay(vacancy.Status),
            CreatedDate = vacancy.CreatedDate,
            Candidates = vacancy.Applications?.Count(a => a.Status != ApplicationStatus.Rejected) ?? 0,
            RequestedBy = vacancy.RequestedBy is int requesterId ? userNames.GetValueOrDefault(requesterId) : null,
            Salary = vacancy.Salary,
            Shift = vacancy.Shift,
            Source = vacancy.Source,
            Description = NullIfBlank(vacancy.Description),
            Requirements = NullIfBlank(vacancy.Requirements),
        };

        private static VacancyRequestItem BuildVacancyRequestItem(VacancyRequest request, IReadOnlyDictionary<int, string> userNames) => new()
        {
            Id = request.Id,
            PositionId = request.PositionId,
            Position = request.Position?.Title ?? string.Empty,
            GymId = request.GymId,
            Gym = request.Gym?.Name ?? string.Empty,
            Urgency = request.Urgency,
            Status = VacancyRequestStatusDisplay(request.Status),
            SubmittedBy = userNames.GetValueOrDefault(request.RequestedBy),
            SubmittedDate = request.SubmittedDate,
            Reason = request.Justification,
            Salary = request.Salary,
            Shift = request.Shift,
            Headcount = request.Headcount,
            DecidedBy = request.DecidedBy is int decidedId ? userNames.GetValueOrDefault(decidedId) : null,
            VacancyId = request.ResultingVacancyId,
        };

        /// <summary>
        /// Gym gate for an application: the vacancy's branch, else the applicant's typed
        /// preferred branch (hiring-form conversions), else null (org-wide permission).
        /// </summary>
        private async Task<int?> ApplicationGymIdAsync(Application application, CancellationToken cancellationToken)
        {
            if (application.Vacancy is not null)
            {
                return application.Vacancy.GymId;
            }

            return await PreferredGymIdAsync(application.PreferredGym, cancellationToken);
        }

        /// <summary>Typed branch name → gym id (null when blank or unknown — no gate).</summary>
        private async Task<int?> PreferredGymIdAsync(string? preferredGym, CancellationToken cancellationToken)
        {
            var name = NullIfBlank(preferredGym);
            if (name is null)
            {
                return null;
            }

            var gyms = await _unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken);
            return gyms
                .Where(g => string.Equals(g.Name, name, StringComparison.OrdinalIgnoreCase))
                .Select(g => (int?)g.Id)
                .FirstOrDefault();
        }

        private static CandidateItem BuildCandidateItem(Application application)
        {
            var candidate = application.Candidate;
            var screen = application.PipelineStages?
                .Where(s => s.Stage == PipelineStageType.Screening)
                .OrderByDescending(s => s.EnteredDate)
                .FirstOrDefault();
            var iv1 = application.Interviews?
                .Where(i => i.Stage == PipelineStageType.FirstInterview)
                .OrderBy(i => i.Id)
                .FirstOrDefault();
            var iv2 = application.Interviews?
                .Where(i => i.Stage == PipelineStageType.SecondInterview)
                .OrderBy(i => i.Id)
                .FirstOrDefault();

            var item = new CandidateItem
            {
                Id = candidate.Id,
                ApplicationId = application.Id,
                Name = candidate.FullName,
                Initials = BuildInitials(candidate.FullName),
                Position = application.Vacancy?.Title ?? application.PositionTitle,
                Stage = StageDisplay(application.CurrentStage),
                AppliedDate = application.AppliedDate,
                Phone = candidate.Phone,
                Rating = candidate.Rating,
                Blocked = candidate.Blocked,
                BlockReason = candidate.BlockReason,
                HiredDate = application.HiredDate,
                RejectedDate = application.RejectedAt,
                RejectedBy = application.RejectedBy?.ToString(),
                RejectReason = application.RejectReason,
                Form = new CandidateForm
                {
                    Email = candidate.Email,
                    Source = application.Source,
                    GymPref = application.PreferredGym,
                    ExpYears = application.ExperienceYears,
                    Education = candidate.EducationJson ?? application.Education,
                    Skills = ParseJsonStringArray(candidate.SkillsJson),
                    Languages = ParseJsonStringArray(application.LanguagesJson),
                    Shift = application.ShiftPreference,
                    SalaryExp = application.SalaryExpectation,
                    Availability = application.Availability,
                },
                Screen = screen is null ? null : new CandidateStageBlock
                {
                    Date = screen.CompletedDate ?? screen.EnteredDate,
                    By = screen.ByUserId?.ToString(),
                    Verdict = screen.Outcome,
                    Eval = screen.Notes,
                },
                Iv1 = iv1 is null ? null : BuildStageBlock(iv1),
                Iv2 = iv2 is null ? null : BuildStageBlock(iv2),
            };

            if (application.Status == ApplicationStatus.Hired)
            {
                item.Decision = new CandidateDecisionBlock
                {
                    By = application.DecisionBy?.ToString(),
                    Date = application.DecisionAt ?? application.HiredDate,
                    Verdict = "Accepted",
                    Note = application.DecisionNote,
                };
            }
            else if (application.Status == ApplicationStatus.Rejected)
            {
                item.Decision = new CandidateDecisionBlock
                {
                    By = application.RejectedBy?.ToString(),
                    Date = application.RejectedAt,
                    Verdict = "Rejected",
                    Note = application.DecisionNote ?? application.RejectReason,
                };
            }
            else if (application.CurrentStage is PipelineStageType.Accepted or PipelineStageType.FinalDecision)
            {
                item.Decision = new CandidateDecisionBlock
                {
                    By = application.DecisionBy?.ToString(),
                    Date = application.DecisionAt,
                    Verdict = "Accepted",
                    Note = application.DecisionNote,
                };
            }

            return item;
        }

        private static CandidateStageBlock BuildStageBlock(Interview interview) => new()
        {
            Date = interview.CompletedAt ?? interview.ScheduledDate,
            By = interview.ConductedBy?.ToString(),
            Verdict = interview.Verdict ?? interview.Outcome.ToString(),
            Eval = interview.Evaluation,
            Type = interview.Type,
            Room = interview.Room,
            Notes = interview.InterviewerNotes,
        };

        private static InterviewItem BuildInterviewItem(Interview interview, IReadOnlyDictionary<int, string>? userNames = null) => new()
        {
            Id = interview.Id,
            CandidateId = interview.Application?.CandidateId,
            Candidate = interview.Application?.Candidate?.FullName ?? string.Empty,
            Position = interview.Application?.Vacancy?.Title,
            Gym = interview.Application?.Vacancy?.Gym?.Name,
            Date = DateOnly.FromDateTime(interview.ScheduledDate),
            Time = interview.ScheduledDate.ToString("HH:mm"),
            ScheduledDate = interview.ScheduledDate,
            Type = interview.Type,
            Interviewer = interview.ConductedBy is int conductorId && userNames is not null
                ? userNames.GetValueOrDefault(conductorId)
                : interview.InterviewerName,
            Status = interview.Status,
            Room = interview.Room,
            Verdict = interview.Verdict,
            Evaluation = interview.Evaluation,
        };

        private static string BuildInitials(string fullName)
        {
            var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            return parts.Length >= 2
                ? $"{parts[0][0]}{parts[^1][0]}".ToUpperInvariant()
                : parts.Length == 1 ? parts[0][0].ToString().ToUpperInvariant() : string.Empty;
        }

        private static IReadOnlyList<string> ParseJsonStringArray(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return [];
            }

            try
            {
                return JsonSerializer.Deserialize<string[]>(json) ?? [];
            }
            catch (JsonException)
            {
                // Legacy plain-text value — surface it as a single entry.
                return [json];
            }
        }

        /// <summary>Partial position match, either direction (the mock's waiting-list matcher).</summary>
        private static bool PositionMatches(string candidatePosition, string vacancyTitle)
        {
            var left = candidatePosition.Trim().ToLowerInvariant();
            var right = vacancyTitle.Trim().ToLowerInvariant();
            return left.Length > 0 && right.Length > 0 &&
                (left.Contains(right, StringComparison.Ordinal) || right.Contains(left, StringComparison.Ordinal));
        }

        private static string StageDisplay(PipelineStageType stage) => stage switch
        {
            PipelineStageType.FirstInterview => "First Interview",
            PipelineStageType.SecondInterview => "Second Interview",
            _ => stage.ToString(),
        };

        private static PipelineStageType? ParseStageOrNull(string? value)
        {
            if (NullIfBlank(value) is not string stage)
            {
                return null;
            }

            var normalized = stage.Replace(" ", string.Empty, StringComparison.Ordinal)
                .Replace("-", string.Empty, StringComparison.Ordinal);
            return Enum.TryParse<PipelineStageType>(normalized, ignoreCase: true, out var parsed)
                ? parsed
                : null;
        }

        private static string VacancyStatusDisplay(VacancyStatus status) => status switch
        {
            VacancyStatus.Open => "Open",
            VacancyStatus.Draft => "Draft",
            VacancyStatus.Closed => "Closed",
            _ => "Archived",
        };

        private static VacancyStatus? ParseVacancyStatusOrNull(string? value) => NullIfBlank(value) switch
        {
            null => null,
            var s when s.Equals("Open", StringComparison.OrdinalIgnoreCase) => VacancyStatus.Open,
            var s when s.Equals("Draft", StringComparison.OrdinalIgnoreCase) => VacancyStatus.Draft,
            var s when s.Equals("Closed", StringComparison.OrdinalIgnoreCase) => VacancyStatus.Closed,
            var s when s.Equals("Archived", StringComparison.OrdinalIgnoreCase) => VacancyStatus.Archived,
            _ => throw new BadRequestException("Status must be Open, Draft, or Closed."),
        };

        private static VacancyStatus? ParseVacancyWriteStatusOrNull(string? value) => NullIfBlank(value) switch
        {
            null => null,
            var s when s.Equals("Open", StringComparison.OrdinalIgnoreCase) => VacancyStatus.Open,
            var s when s.Equals("Draft", StringComparison.OrdinalIgnoreCase) => VacancyStatus.Draft,
            var s when s.Equals("Closed", StringComparison.OrdinalIgnoreCase) => VacancyStatus.Closed,
            var s when s.Equals("Archived", StringComparison.OrdinalIgnoreCase) => VacancyStatus.Archived,
            _ => throw new BadRequestException("Status must be Open, Draft, or Closed."),
        };

        private static string VacancyRequestStatusDisplay(VacancyRequestStatus status) => status switch
        {
            VacancyRequestStatus.Approved => "Approved",
            VacancyRequestStatus.Rejected => "Rejected",
            _ => "Pending",
        };

        private static VacancyRequestStatus? ParseVacancyRequestStatusOrNull(string? value) => NullIfBlank(value) switch
        {
            null => null,
            var s when s.Equals("Pending", StringComparison.OrdinalIgnoreCase) => VacancyRequestStatus.Pending,
            var s when s.Equals("Approved", StringComparison.OrdinalIgnoreCase) => VacancyRequestStatus.Approved,
            var s when s.Equals("Rejected", StringComparison.OrdinalIgnoreCase) => VacancyRequestStatus.Rejected,
            _ => throw new BadRequestException("Status must be Pending, Approved, or Rejected."),
        };

        private static string? NormalizeUrgency(string? urgency) => NullIfBlank(urgency) switch
        {
            null => null,
            var u when u.Equals("Low", StringComparison.OrdinalIgnoreCase) => "Low",
            var u when u.Equals("Medium", StringComparison.OrdinalIgnoreCase) => "Medium",
            var u when u.Equals("High", StringComparison.OrdinalIgnoreCase) => "High",
            _ => throw new BadRequestException("Urgency must be Low, Medium, or High."),
        };

        private static string DisplayName(User user) =>
            string.IsNullOrWhiteSpace(user.UserName) ? user.Email : user.UserName;

        private static string? NullIfBlank(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private static int NormalizePageSize(int pageSize, int fallback = DefaultPageSize) =>
            pageSize <= 0 ? fallback : Math.Min(pageSize, MaxPageSize);
    }
}
