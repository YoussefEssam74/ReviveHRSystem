using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.SchedulingModule;
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

