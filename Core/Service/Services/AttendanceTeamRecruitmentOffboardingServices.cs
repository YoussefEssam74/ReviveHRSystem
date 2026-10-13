using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.RequestModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;

namespace Service.Services
{
    /// <summary>
    /// Team overview (mock §13 My Team): the teams the caller leads or belongs to in
    /// the active gym, and a team-day view with per-member status and shift.
    /// </summary>
    public class TeamOverviewService(
        IUnitOfWork unitOfWork,
        ITeamScopeService teamScopeService,
        IMapper mapper) : ITeamOverviewService
    {
        public async Task<IReadOnlyList<TeamDto>> GetMyTeamsAsync(
            int actorUserId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            var employee = await OwnEmployeeAsync(actorUserId, cancellationToken);

            var teams = await unitOfWork.GetRepository<Team, int>()
                .GetAllAsync(new TeamsByMemberOrLeaderSpec(employee.Id, gymId), cancellationToken);

            return teams
                .Select(t => mapper.Map<TeamDto>(t, opts => opts.Items["selfEmployeeId"] = employee.Id))
                .ToList();
        }

        public async Task<TeamTodayDto> GetTeamTodayAsync(
            int actorUserId, int teamId, int? activeGymId, DateOnly? date, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);

            var team = await unitOfWork.GetRepository<Team, int>()
                .GetByIdAsync(new TeamWithMembersSpec(teamId), cancellationToken)
                ?? throw new NotFoundException("Team not found.");

            if (team.GymId != gymId)
            {
                throw new NotFoundException("Team not found.");
            }

            // The caller must lead the team or belong to it in this gym.
            var myTeams = await GetMyTeamsAsync(actorUserId, activeGymId, cancellationToken);
            if (!myTeams.Any(t => t.Id == teamId))
            {
                throw new NotFoundException("Team not found.");
            }

            var day = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var members = team.Members.ToList();
            var ids = members.Select(m => m.Id).ToList();

            var records = (await unitOfWork.GetRepository<DomainLayer.Models.AttendanceModule.AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeesDateSpec(ids, day), cancellationToken))
                .ToLookup(r => r.EmployeeId);

            var assignments = (await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(new AssignmentsByEmployeesDateSpec(ids, day), cancellationToken))
                .ToLookup(a => a.EmployeeId);

            var requests = await unitOfWork.GetRepository<DomainLayer.Models.RequestModule.EmployeeRequest, int>()
                .GetAllAsync(new RequestsByEmployeesSpec(ids), cancellationToken);

            var memberDtos = members
                .Select(m =>
                {
                    var record = records[m.Id].FirstOrDefault();
                    var assignment = assignments[m.Id].FirstOrDefault();
                    var status = record is null
                        ? (assignment?.ShiftTemplateId is null ? "Off" : "Absent")
                        : record.Status switch
                        {
                            DomainLayer.Models.AttendanceModule.Enums.AttendanceStatus.OnTime => "Present",
                            DomainLayer.Models.AttendanceModule.Enums.AttendanceStatus.Late => "Late",
                            DomainLayer.Models.AttendanceModule.Enums.AttendanceStatus.Absent => "Absent",
                            _ => "Present"
                        };

                    return new TeamMemberDayDto
                    {
                        EmployeeId = m.Id,
                        Name = m.FullName,
                        Position = m.Position?.Title ?? string.Empty,
                        Status = status,
                        CheckIn = record?.CheckInTime is null ? null : TimeOnly.FromDateTime(record.CheckInTime.Value),
                        Initials = InitialsOf(m.FullName),
                        ShiftName = assignment?.ShiftTemplate?.Name,
                        ShiftStart = assignment?.ShiftTemplate?.StartTime,
                        ShiftEnd = assignment?.ShiftTemplate?.EndTime,
                        IsOff = assignment?.ShiftTemplateId is null
                    };
                })
                .ToList();

            return new TeamTodayDto
            {
                TeamId = team.Id,
                TeamName = team.Name,
                Stats = new TeamStatsDto
                {
                    Total = memberDtos.Count,
                    Present = memberDtos.Count(m => m.Status == "Present"),
                    Late = memberDtos.Count(m => m.Status == "Late"),
                    Absent = memberDtos.Count(m => m.Status == "Absent"),
                    PendingRequests = requests.Count(r => r.Status == DomainLayer.Models.RequestModule.Enums.RequestStatus.Pending
                        || r.Status == DomainLayer.Models.RequestModule.Enums.RequestStatus.PendingHRReview)
                },
                Members = memberDtos
            };
        }

        /// <summary>
        /// Counts team members with no published assignment: either no assignment row at
        /// all, or only Off-day (null template) rows. Members are the team's own roster,
        /// so the count is team-scoped by construction.
        /// </summary>
        public async Task<int> GetUnscheduledCountAsync(
            int actorUserId, int teamId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);

            var team = await unitOfWork.GetRepository<Team, int>()
                .GetByIdAsync(new TeamWithMembersSpec(teamId), cancellationToken)
                ?? throw new NotFoundException("Team not found.");

            if (team.GymId != gymId)
            {
                throw new NotFoundException("Team not found.");
            }

            var myTeams = await GetMyTeamsAsync(actorUserId, activeGymId, cancellationToken);
            if (!myTeams.Any(t => t.Id == teamId))
            {
                throw new NotFoundException("Team not found.");
            }

            var memberIds = team.Members.Select(m => m.Id).ToList();
            if (memberIds.Count == 0)
            {
                return 0;
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var cycles = await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftCycle, int>()
                .GetAllAsync(new PublishedCyclesByGymSpec(gymId, today, DateOnly.MaxValue), cancellationToken);

            // A published cycle only ever carries real templates for scheduled days,
            // and only cycles whose window is current or upcoming count as scheduled.
            var scheduledIds = new HashSet<int>();
            foreach (var cycle in cycles)
            {
                var assignments = await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                    .GetAllAsync(new AssignmentsByCycleAndEmployeesSpec(cycle.Id, memberIds), cancellationToken);

                foreach (var assignment in assignments.Where(a => a.ShiftTemplateId is not null))
                {
                    scheduledIds.Add(assignment.EmployeeId);
                }
            }

            return memberIds.Count(id => !scheduledIds.Contains(id));
        }

        private async Task<Employee> OwnEmployeeAsync(int actorUserId, CancellationToken cancellationToken) =>            await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken)
            ?? throw new UnAuthorizedException("This account has no employee profile.");

        private static int RequireGym(int? activeGymId) =>
            activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");

        private static string InitialsOf(string name) =>
            string.Concat(name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(2).Select(w => char.ToUpperInvariant(w[0])));
    }

    /// <summary>
    /// Vacancy requests (mock §23). Requests are branch artifacts: the list is
    /// gym-scoped even for team leaders (their capability is equal, the artifact is
    /// the gym's), and creation is gated by the recruitment feature.
    /// </summary>
    public class VacancyRequestService(
        IUnitOfWork unitOfWork,
        IMapper mapper) : IVacancyRequestService
    {
        public async Task<PaginationResult<VacancyRequestDto>> GetRequestsAsync(
            int actorUserId, int? activeGymId, VacancyQueryParams query, CancellationToken cancellationToken = default)
        {
            var gymId = activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");

            var requests = await unitOfWork.GetRepository<VacancyRequest, int>()
                .GetAllAsync(new VacancyRequestsByGymSpec(gymId), cancellationToken);

            var filtered = string.IsNullOrWhiteSpace(query.Status)
                ? requests.ToList()
                : requests
                    .Where(r => r.Status.ToString().Equals(query.Status, StringComparison.OrdinalIgnoreCase))
                    .ToList();

            var page = filtered
                .OrderByDescending(r => r.Id)
                .Skip(query.SkipCount)
                .Take(query.PageSize)
                .Select(r => mapper.Map<VacancyRequestDto>(r))
                .ToList();

            return new PaginationResult<VacancyRequestDto>(query.PageNumber, query.PageSize, filtered.Count, page);
        }

        public async Task<VacancyRequestDto> GetRequestAsync(
            int actorUserId, int? activeGymId, int vacancyRequestId, CancellationToken cancellationToken = default)
        {
            var gymId = activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");

            var requests = await unitOfWork.GetRepository<VacancyRequest, int>()
                .GetAllAsync(new VacancyRequestsByGymSpec(gymId), cancellationToken);

            var request = requests.FirstOrDefault(r => r.Id == vacancyRequestId)
                ?? throw new NotFoundException("Vacancy request not found.");

            return mapper.Map<VacancyRequestDto>(request);
        }

        public async Task<VacancyRequestDto> CreateAsync(
            int actorUserId, int? activeGymId, CreateVacancyRequestDto request, CancellationToken cancellationToken = default)
        {
            var gymId = activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");

            if (string.IsNullOrWhiteSpace(request.Justification))
            {
                throw new BadRequestException("A justification is required.");
            }

            var positions = await unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Position, int>()
                .GetAllAsync(new PositionsByGymSpec(gymId), cancellationToken);
            var position = positions.FirstOrDefault(p => p.Id == request.PositionId)
                ?? throw new BadRequestException("The selected position does not belong to the active gym.");

            var vacancyRequest = new VacancyRequest
            {
                GymId = gymId,
                PositionId = position.Id,
                RequestedBy = actorUserId,
                Justification = request.Justification.Trim(),
                Status = VacancyRequestStatus.Pending
            };

            await unitOfWork.GetRepository<VacancyRequest, int>().AddAsync(vacancyRequest, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            // Reload with navigations so the response matches the list projection.
            var reloaded = await unitOfWork.GetRepository<VacancyRequest, int>()
                .GetAllAsync(new VacancyRequestsByGymSpec(gymId), cancellationToken);

            return mapper.Map<VacancyRequestDto>(reloaded.First(r => r.Id == vacancyRequest.Id));
        }
    }

    /// <summary>
    /// Employee leaving / offboarding (mock §24). Cases are gym-scoped; initiation
    /// targets an in-scope employee and records the case plus an employment-history
    /// event so the timeline preserves the change.
    /// </summary>
    public class OffboardingService(
        IUnitOfWork unitOfWork,
        ITeamScopeService teamScopeService,
        IMapper mapper) : IOffboardingService
    {
        public async Task<PaginationResult<OffboardingCaseDto>> GetCasesAsync(
            int actorUserId, int? activeGymId, OffboardingQueryParams query, CancellationToken cancellationToken = default)
        {
            var gymId = activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");
            var ids = await ScopedEmployeeIdsAsync(actorUserId, gymId, cancellationToken);

            var cases = await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.OffboardingCase, int>()
                .GetAllAsync(new OffboardingCasesByEmployeesSpec(ids), cancellationToken);

            var filtered = string.IsNullOrWhiteSpace(query.Status)
                ? cases.ToList()
                : cases
                    .Where(c => c.Status.Equals(query.Status, StringComparison.OrdinalIgnoreCase))
                    .ToList();

            var page = filtered
                .OrderByDescending(c => c.InitiatedAt)
                .ThenByDescending(c => c.Id)
                .Skip(query.SkipCount)
                .Take(query.PageSize)
                .Select(c => mapper.Map<OffboardingCaseDto>(c))
                .ToList();

            return new PaginationResult<OffboardingCaseDto>(query.PageNumber, query.PageSize, filtered.Count, page);
        }

        public async Task<OffboardingCaseDto> InitiateAsync(
            int actorUserId, int? activeGymId, InitiateOffboardingDto request, CancellationToken cancellationToken = default)
        {
            var gymId = activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");

            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new BadRequestException("A reason is required.");
            }

            var ids = await ScopedEmployeeIdsAsync(actorUserId, gymId, cancellationToken);
            if (!ids.Contains(request.EmployeeId))
            {
                throw new NotFoundException("Employee not found.");
            }

            var existing = await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.OffboardingCase, int>()
                .GetAllAsync(new OffboardingCasesByEmployeesSpec(new[] { request.EmployeeId }), cancellationToken);
            if (existing.Any(c => c.Status is "Open" or "Notice Period"))
            {
                throw new BadRequestException("This employee already has an open leaving process.");
            }

            var offboardingCase = new DomainLayer.Models.EmployeeModule.OffboardingCase
            {
                EmployeeId = request.EmployeeId,
                LastWorkingDate = request.LastWorkingDate,
                Reason = request.Reason.Trim(),
                Status = "Notice Period",
                InitiatedBy = actorUserId,
                InitiatedAt = DateTime.UtcNow
            };

            await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.OffboardingCase, int>()
                .AddAsync(offboardingCase, cancellationToken);

            var history = new DomainLayer.Models.EmployeeModule.EmploymentHistory
            {
                EmployeeId = request.EmployeeId,
                ChangeType = DomainLayer.Models.EmployeeModule.Enums.EmploymentChangeType.Offboard,
                OldValueJson = System.Text.Json.JsonSerializer.Serialize("Active"),
                NewValueJson = System.Text.Json.JsonSerializer.Serialize("Offboarding"),
                EffectiveDate = request.LastWorkingDate,
                ChangedBy = actorUserId,
                Reason = request.Reason.Trim()
            };
            await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.EmploymentHistory, int>()
                .AddAsync(history, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeProfileByIdSpec(request.EmployeeId), cancellationToken);

            return new OffboardingCaseDto
            {
                Id = offboardingCase.Id,
                EmployeeId = request.EmployeeId,
                Employee = employee?.FullName ?? string.Empty,
                Position = employee?.Position?.Title ?? string.Empty,
                LastWorkingDate = offboardingCase.LastWorkingDate,
                Status = offboardingCase.Status,
                Reason = offboardingCase.Reason
            };
        }

        private async Task<List<int>> ScopedEmployeeIdsAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var ledTeamId = await teamScopeService.GetLedTeamIdAsync(actorUserId, gymId, cancellationToken);

            var employees = ledTeamId is not null
                ? await unitOfWork.GetRepository<Employee, int>().GetAllAsync(new EmployeesByTeamSpec(ledTeamId.Value), cancellationToken)
                : await unitOfWork.GetRepository<Employee, int>().GetAllAsync(new EmployeesByGymSpec(gymId), cancellationToken);

            return employees.Select(e => e.Id).ToList();
        }
    }
}
