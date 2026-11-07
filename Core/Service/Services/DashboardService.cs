using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Dashboard aggregate (mock Â§1). The gym context and the caller's team scope are
    /// resolved server-side from the token and the per-gym role; the overview strip is
    /// only populated when the caller holds the employees feature at View level.
    /// </summary>
    public class DashboardService(
        IUnitOfWork unitOfWork,
        IPermissionService permissionService,
        ITeamScopeService teamScopeService,
        IUserAccessRepository userAccess,
        IAccessControlService accessControl,
        IMapper mapper) : IDashboardService
    {
        public async Task<EmployeeDashboardDto> GetDashboardAsync(int userId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var user = await unitOfWork.GetRepository<DomainLayer.Models.UserModule.User, int>()
                .GetByIdAsync(new UserByIdSpec(userId), cancellationToken)
                ?? throw new DomainLayer.Exceptions.NotFoundException("User not found.");

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeSummaryByUserIdSpec(userId), cancellationToken);

            var greeting = DateTime.UtcNow.Hour < 12 ? "Good morning"
                : DateTime.UtcNow.Hour < 17 ? "Good afternoon"
                : "Good evening";

            var userDto = employee is not null
                ? mapper.Map<DashboardUserDto>(employee)
                : new DashboardUserDto { FirstName = user.UserName };

            if (employee is null)
            {
                return Empty(greeting, userDto);
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var parts = await LoadEmployeePartsAsync(employee, today, cancellationToken);

            return new EmployeeDashboardDto
            {
                Greeting = greeting,
                User = userDto,
                TodayShift = parts.TodayShift,
                TodayAttendance = parts.TodayAttendance,
                MonthSummary = parts.MonthSummary,
                UpcomingSchedule = parts.UpcomingSchedule,
                PendingRequestCount = parts.PendingRequestCount,
                LatestPayroll = parts.LatestPayroll,
                RecentNotifications = parts.RecentNotifications,
                ActionRequired = parts.ActionRequired,
                Overview = await LoadOverviewAsync(user, employee, activeGymId ?? employee.GymId, today, cancellationToken)
            };
        }

        private static EmployeeDashboardDto Empty(string greeting, DashboardUserDto user) => new()
        {
            Greeting = greeting,
            User = user,
            MonthSummary = new AttendanceSummaryDto()
        };

        private async Task<DashboardParts> LoadEmployeePartsAsync(
            Employee employee, DateOnly today, CancellationToken cancellationToken)
        {
            // Today's shift from published assignments.
            DashboardShiftDto? todayShift = null;
            var todayAssignments = await unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetAllAsync(new AssignmentsByEmployeeRangeSpec(employee.Id, today, today), cancellationToken);
            var todayAssignment = todayAssignments.FirstOrDefault(a => a.ShiftTemplateId is not null);
            if (todayAssignment?.ShiftTemplate is not null)
            {
                todayShift = mapper.Map<DashboardShiftDto>(todayAssignment);
            }

            // Today's attendance.
            DashboardAttendanceDto? todayAttendance = null;
            var todayRecords = await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeeDateSpec(employee.Id, today), cancellationToken);
            var record = todayRecords.FirstOrDefault();
            if (record is not null)
            {
                todayAttendance = mapper.Map<DashboardAttendanceDto>(record);
            }

            // Month summary.
            var monthStart = new DateOnly(today.Year, today.Month, 1);
            var monthRecords = (await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeeSpec(employee.Id, monthStart), cancellationToken)).ToList();
            var present = monthRecords.Count(r => r.Status is AttendanceStatus.OnTime or AttendanceStatus.Late);

            // Upcoming schedule: the next five published days.
            var upcoming = (await unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetAllAsync(new AssignmentsByEmployeeRangeSpec(employee.Id, today, today.AddDays(6)), cancellationToken))
                .Where(a => a.Date >= today)
                .OrderBy(a => a.Date)
                .Take(5)
                .Select(a => mapper.Map<ScheduleDayDto>(a, opts => opts.Items["today"] = today))
                .ToList();

            // Pending requests.
            var requests = await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new RequestsByEmployeeSpec(employee.Id), cancellationToken);
            var pendingRequests = requests.Count(r => r.Status == RequestStatus.Pending || r.Status == RequestStatus.PendingHRReview);

            // Latest non-open payroll entry.
            var periodIds = await AllGymPeriodIdsAsync(employee.GymId, cancellationToken);
            var payrollEntries = await unitOfWork.GetRepository<PayrollEntry, int>()
                .GetAllAsync(new PayrollEntriesByEmployeeSpec(employee.Id, periodIds), cancellationToken);
            var latest = payrollEntries
                .Where(e => e.PayrollPeriod.Status != PayrollPeriodStatus.Open)
                .OrderByDescending(e => e.PayrollPeriod.EndDate)
                .FirstOrDefault();

            // Recent notifications.
            var notifications = await unitOfWork.GetRepository<Notification, int>()
                .GetAllAsync(new NotificationsByUserSpec(employee.UserId, unreadOnly: false, category: null, skip: 0, take: 5), cancellationToken);

            // Required actions: documents expiring within 30 days.
            var documents = await unitOfWork.GetRepository<EmployeeDocument, int>()
                .GetAllAsync(new DocumentsByEmployeeSpec(employee.Id), cancellationToken);
            var expiryHorizon = today.AddDays(30);

            return new DashboardParts
            {
                TodayShift = todayShift,
                TodayAttendance = todayAttendance,
                MonthSummary = new AttendanceSummaryDto
                {
                    Rate = monthRecords.Count == 0 ? 0 : (int)Math.Round(present * 100.0 / monthRecords.Count),
                    Present = present,
                    Late = monthRecords.Count(r => r.Status == AttendanceStatus.Late),
                    Absent = monthRecords.Count(r => r.Status == AttendanceStatus.Absent),
                    EarlyCheckout = monthRecords.Count(r => r.Status == AttendanceStatus.EarlyCheckout),
                    MissingCheckout = monthRecords.Count(r => r.Status == AttendanceStatus.MissingCheckout)
                },
                UpcomingSchedule = upcoming,
                PendingRequestCount = pendingRequests,
                LatestPayroll = latest is null ? null : mapper.Map<PayrollEntryDto>(latest),
                RecentNotifications = notifications.Take(3).Select(n => mapper.Map<NotificationDto>(n)).ToList(),
                ActionRequired = documents
                    .Where(d => d.ExpiryDate.HasValue && d.ExpiryDate.Value <= expiryHorizon)
                    .Select(d => mapper.Map<DashboardActionDto>(d))
                    .ToList()
            };
        }

        private async Task<DashboardOverviewDto?> LoadOverviewAsync(
            DomainLayer.Models.UserModule.User user, Employee employee, int activeGymId, DateOnly today, CancellationToken cancellationToken)
        {
            // Only callers with the employees feature at View level in the ACTIVE gym
            // see the strip.
            var hasAccess = await permissionService.HasAccessAsync(
                user.Id, activeGymId, Features.Employees, DomainLayer.Models.UserModule.Enums.AccessLevel.View, cancellationToken);
            if (!hasAccess)
            {
                return null;
            }

            var ledTeamId = await teamScopeService.GetLedTeamIdAsync(user.Id, activeGymId, cancellationToken);

            List<Employee> scoped;
            string scope;
            if (ledTeamId is not null)
            {
                scoped = (await unitOfWork.GetRepository<Employee, int>()
                    .GetAllAsync(new EmployeesByTeamSpec(ledTeamId.Value), cancellationToken)).ToList();
                scope = "team";
            }
            else
            {
                scoped = (await unitOfWork.GetRepository<Employee, int>()
                    .GetAllAsync(new EmployeesByGymSpec(activeGymId), cancellationToken)).ToList();
                scope = "branch";
            }

            var scopedIds = scoped.Select(e => e.Id).ToList();
            var attendance = await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeesDateSpec(scopedIds, today), cancellationToken);
            var requests = await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new RequestsByEmployeesSpec(scopedIds), cancellationToken);

            return new DashboardOverviewDto
            {
                Scope = scope,
                MemberCount = scoped.Count,
                PresentToday = attendance.Count(a => a.Status == AttendanceStatus.OnTime || a.Status == AttendanceStatus.Late),
                PendingRequests = requests.Count(r => r.Status == RequestStatus.Pending || r.Status == RequestStatus.PendingHRReview),
                Absent = attendance.Count(a => a.Status == AttendanceStatus.Absent)
            };
        }

        // ==================================================================
        // HR portal dashboard (GET /api/dashboard/hr)
        // ==================================================================

        public async Task<HrDashboardDto> GetHrDashboardAsync(int userId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var user = await unitOfWork.GetRepository<DomainLayer.Models.UserModule.User, int>()
                .GetByIdAsync(new UserByIdSpec(userId), cancellationToken)
                ?? throw new DomainLayer.Exceptions.NotFoundException("User not found.");

            // ADR-003: the caller's gym scope drives the whole aggregate; an
            // active gym narrows it further (same rule as the employee variant).
            var allowed = (await userAccess.GetGymAccessAsync(user.Id, cancellationToken)).Select(g => g.GymId).ToList();
            var inScope = user.UserType == UserType.TopManagement
                ? (activeGymId.HasValue ? new[] { activeGymId.Value } : Array.Empty<int>())
                : (activeGymId.HasValue && allowed.Contains(activeGymId.Value) ? new[] { activeGymId.Value } : allowed.ToArray());

            bool InScope(int gymId) => inScope.Length == 0 || inScope.Contains(gymId);

            // ---- gyms + headcount (Branches Oversight + KPI) ----
            var allGyms = await unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken);
            var scopedGyms = allGyms.Where(g => InScope(g.Id)).OrderBy(g => g.Name).ToList();
            var employees = await unitOfWork.GetRepository<Employee, int>().GetAllAsync(cancellationToken);
            var scopedEmployees = employees.Where(e => InScope(e.GymId)).ToList();
            var employeeIds = scopedEmployees.Select(e => e.Id).ToList();
            var nameById = scopedEmployees.ToDictionary(e => e.Id, e => e.FullName);
            var gymNameById = scopedGyms.ToDictionary(g => g.Id, g => g.Name);

            // ---- pending sources ----
            var requests = employeeIds.Count == 0
                ? new List<DomainLayer.Models.RequestModule.EmployeeRequest>()
                : (await unitOfWork.GetRepository<DomainLayer.Models.RequestModule.EmployeeRequest, int>()
                    .GetAllAsync(new RequestsByEmployeesSpec(employeeIds), cancellationToken)).ToList();
            var pendingRequests = requests.Where(r => r.Status == RequestStatus.PendingHRReview).ToList();

            var vacancies = new List<VacancyRequest>();
            foreach (var gym in scopedGyms)
            {
                var gymVacancies = await unitOfWork.GetRepository<VacancyRequest, int>()
                    .GetAllAsync(new VacancyRequestsByGymSpec(gym.Id), cancellationToken);
                vacancies.AddRange(gymVacancies.Where(v => v.Status == VacancyRequestStatus.Pending));
            }

            var deductions = employeeIds.Count == 0
                ? new List<DeductionCandidate>()
                : (await unitOfWork.GetRepository<DeductionCandidate, int>()
                    .GetAllAsync(new DeductionCandidatesByEmployeesSpec(employeeIds), cancellationToken)).Where(d => d.Status == DeductionStatus.Pending).ToList();
            var warnings = employeeIds.Count == 0
                ? new List<WarningNotice>()
                : (await unitOfWork.GetRepository<WarningNotice, int>()
                    .GetAllAsync(new WarningNoticesByEmployeesSpec(employeeIds), cancellationToken)).Where(w => w.Status == ProposalStatus.Pending).ToList();
            var bonuses = employeeIds.Count == 0
                ? new List<BonusProposal>()
                : (await unitOfWork.GetRepository<BonusProposal, int>()
                    .GetAllAsync(new BonusProposalsByEmployeesSpec(employeeIds), cancellationToken)).Where(b => b.Status == ProposalStatus.Pending).ToList();

            // Contracts expiring within 30 days (the Contract Expiry action card).
            var today = DateTime.UtcNow.Date;
            var expiringContracts = scopedEmployees
                .Where(e => e.ContractEndDate.HasValue
                    && DateOnly.FromDateTime(today) <= e.ContractEndDate.Value
                    && e.ContractEndDate.Value <= DateOnly.FromDateTime(today.AddDays(30)))
                .ToList();

            // Open payroll periods awaiting sign-off (payroll.approve gated below).
            var openPeriods = new List<DomainLayer.Models.PayrollModule.PayrollPeriod>();
            foreach (var gym in scopedGyms)
            {
                var periods = await unitOfWork.GetRepository<DomainLayer.Models.PayrollModule.PayrollPeriod, int>()
                    .GetAllAsync(new PayrollPeriodsByGymSpec(gym.Id), cancellationToken);
                openPeriods.AddRange(periods.Where(p => p.Status == PayrollPeriodStatus.Open));
            }

            // ---- permission-gated action cards ----
            async Task<bool> CanAsync(string key)
            {
                try
                {
                    await accessControl.EnsurePermissionAsync(user.Id, key, cancellationToken);
                    return true;
                }
                catch (DomainLayer.Exceptions.UnAuthorizedException)
                {
                    return false;
                }
            }

            var actions = new List<HrDashboardActionDto>();

            if (await CanAsync("requests.view"))
            {
                actions.AddRange(pendingRequests.Select(r => new HrDashboardActionDto
                {
                    Id = $"request-{r.Id}",
                    Kind = "request",
                    Badge = r.Type,
                    BadgeClass = "badge-blue",
                    Title = nameById.GetValueOrDefault(r.EmployeeId, "Unknown"),
                    Subtitle = r.Type,
                    Detail = r.Details,
                    Date = r.SubmittedAt,
                    GymId = scopedEmployees.FirstOrDefault(e => e.Id == r.EmployeeId)?.GymId,
                    Gym = gymNameById.GetValueOrDefault(scopedEmployees.FirstOrDefault(e => e.Id == r.EmployeeId)?.GymId ?? 0),
                }));
            }

            if (await CanAsync("recruitment.vacancy_request.approve"))
            {
                actions.AddRange(vacancies.Select(v => new HrDashboardActionDto
                {
                    Id = $"vacancy-{v.Id}",
                    Kind = "vacancy",
                    Badge = "Vacancy",
                    BadgeClass = "badge-purple",
                    Title = v.Position?.Title ?? "Position",
                    Subtitle = $"{v.Headcount} head{(v.Headcount == 1 ? "" : "s")}",
                    Detail = v.Justification,
                    Date = v.SubmittedDate,
                    GymId = v.GymId,
                    Gym = gymNameById.GetValueOrDefault(v.GymId),
                }));
            }

            if (await CanAsync("requests.view"))
            {
                actions.AddRange(deductions.Select(d => new HrDashboardActionDto
                {
                    Id = $"deduction-{d.Id}",
                    Kind = "deduction",
                    Badge = "Deduction",
                    BadgeClass = "badge-yellow",
                    Title = nameById.GetValueOrDefault(d.EmployeeId, "Unknown"),
                    Subtitle = d.Reason,
                    Detail = d.Note,
                    Date = d.IssuedAt,
                    GymId = scopedEmployees.FirstOrDefault(e => e.Id == d.EmployeeId)?.GymId,
                    Gym = gymNameById.GetValueOrDefault(scopedEmployees.FirstOrDefault(e => e.Id == d.EmployeeId)?.GymId ?? 0),
                }));
                actions.AddRange(warnings.Select(w => new HrDashboardActionDto
                {
                    Id = $"warning-{w.Id}",
                    Kind = "warning",
                    Badge = "Warning",
                    BadgeClass = "badge-red",
                    Title = nameById.GetValueOrDefault(w.EmployeeId, "Unknown"),
                    Subtitle = w.Type,
                    Detail = w.Reason,
                    Date = w.IssuedAt,
                    GymId = scopedEmployees.FirstOrDefault(e => e.Id == w.EmployeeId)?.GymId,
                    Gym = gymNameById.GetValueOrDefault(scopedEmployees.FirstOrDefault(e => e.Id == w.EmployeeId)?.GymId ?? 0),
                }));
                actions.AddRange(bonuses.Select(b => new HrDashboardActionDto
                {
                    Id = $"bonus-{b.Id}",
                    Kind = "bonus",
                    Badge = "Bonus",
                    BadgeClass = "badge-green",
                    Title = nameById.GetValueOrDefault(b.EmployeeId, "Unknown"),
                    Subtitle = b.Reason,
                    Detail = b.Note,
                    Date = b.IssuedAt,
                    GymId = scopedEmployees.FirstOrDefault(e => e.Id == b.EmployeeId)?.GymId,
                    Gym = gymNameById.GetValueOrDefault(scopedEmployees.FirstOrDefault(e => e.Id == b.EmployeeId)?.GymId ?? 0),
                }));
            }

            if (await CanAsync("employees.contract.manage"))
            {
                actions.AddRange(expiringContracts.Select(e => new HrDashboardActionDto
                {
                    Id = $"contract-{e.Id}",
                    Kind = "contract",
                    Badge = "Contract",
                    BadgeClass = "badge-orange",
                    Title = e.FullName,
                    Subtitle = "Contract Expiry",
                    Detail = $"Expires {e.ContractEndDate:yyyy-MM-dd}",
                    Date = e.ContractEndDate.Value.ToDateTime(TimeOnly.MinValue),
                    GymId = e.GymId,
                    Gym = gymNameById.GetValueOrDefault(e.GymId),
                }));
            }

            if (await CanAsync("payroll.approve"))
            {
                actions.AddRange(openPeriods.Select(p => new HrDashboardActionDto
                {
                    Id = $"payroll-{p.Id}",
                    Kind = "payroll",
                    Badge = "Payroll",
                    BadgeClass = "badge-brand",
                    Title = gymNameById.GetValueOrDefault(p.GymId, "Gym"),
                    Subtitle = "Payroll Approval",
                    Detail = "Period open — awaiting HR Manager sign-off.",
                    Date = p.StartDate.ToDateTime(TimeOnly.MinValue),
                    GymId = p.GymId,
                    Gym = gymNameById.GetValueOrDefault(p.GymId),
                }));
            }

            var ordered = actions.OrderByDescending(a => a.Date).ToList();

            // ---- branches oversight rows (headcount + per-gym pending summary) ----
            var branches = scopedGyms.Select(g =>
            {
                var gymRequests = pendingRequests.Count(r => scopedEmployees.FirstOrDefault(e => e.Id == r.EmployeeId)?.GymId == g.Id);
                var gymDeductions = deductions.Count(d => scopedEmployees.FirstOrDefault(e => e.Id == d.EmployeeId)?.GymId == g.Id);
                var gymWarnings = warnings.Count(w => scopedEmployees.FirstOrDefault(e => e.Id == w.EmployeeId)?.GymId == g.Id);
                var gymBonuses = bonuses.Count(b => scopedEmployees.FirstOrDefault(e => e.Id == b.EmployeeId)?.GymId == g.Id);
                var gymVacancies = vacancies.Count(v => v.GymId == g.Id);
                var parts = new List<string>();
                if (gymRequests > 0) parts.Add($"{gymRequests} request{(gymRequests == 1 ? "" : "s")}");
                if (gymVacancies > 0) parts.Add($"{gymVacancies} vacanc{(gymVacancies == 1 ? "y" : "ies")}");
                if (gymDeductions > 0) parts.Add($"{gymDeductions} deduction{(gymDeductions == 1 ? "" : "s")}");
                if (gymWarnings > 0) parts.Add($"{gymWarnings} warning{(gymWarnings == 1 ? "" : "s")}");
                if (gymBonuses > 0) parts.Add($"{gymBonuses} bonus{(gymBonuses == 1 ? "" : "es")}");

                return new HrDashboardBranchDto
                {
                    GymId = g.Id,
                    Name = g.Name,
                    Location = g.Location,
                    Headcount = scopedEmployees.Count(e => e.GymId == g.Id),
                    PendingActions = parts.Count,
                    Summary = parts.Count == 0 ? "All clear" : string.Join(" · ", parts),
                };
            }).ToList();

            var greeting = DateTime.UtcNow.Hour < 12 ? "Good morning"
                : DateTime.UtcNow.Hour < 17 ? "Good afternoon"
                : "Good evening";

            return new HrDashboardDto
            {
                Greeting = greeting,
                UserName = user.UserName,
                Kpis = new HrDashboardKpisDto
                {
                    TotalGyms = scopedGyms.Count,
                    TotalStaff = scopedEmployees.Count,
                    TotalPendingRequests = pendingRequests.Count,
                    ActionsNeeded = ordered.Count,
                },
                Actions = ordered,
                Branches = branches,
            };
        }

        private async Task<IReadOnlyList<int>> AllGymPeriodIdsAsync(int gymId, CancellationToken cancellationToken)
        {
            var periods = await unitOfWork.GetRepository<DomainLayer.Models.PayrollModule.PayrollPeriod, int>()
                .GetAllAsync(new PayrollPeriodsByGymSpec(gymId), cancellationToken);
            return periods.Select(p => p.Id).ToList();
        }

        private sealed class DashboardParts
        {
            public DashboardShiftDto? TodayShift { get; init; }
            public DashboardAttendanceDto? TodayAttendance { get; init; }
            public AttendanceSummaryDto MonthSummary { get; init; } = new();
            public IReadOnlyList<ScheduleDayDto> UpcomingSchedule { get; init; } = Array.Empty<ScheduleDayDto>();
            public int PendingRequestCount { get; init; }
            public PayrollEntryDto? LatestPayroll { get; init; }
            public IReadOnlyList<NotificationDto> RecentNotifications { get; init; } = Array.Empty<NotificationDto>();
            public IReadOnlyList<DashboardActionDto> ActionRequired { get; init; } = Array.Empty<DashboardActionDto>();
        }
    }
}

