using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
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
    /// Dashboard aggregate (mock §1). The gym context and the caller's team scope are
    /// resolved server-side from the token and the per-gym role. The role strip
    /// (Team/Branch Overview) is only built for managers (Team Leader / Branch
    /// Manager) — plain employees get no overview block.
    /// </summary>
    public class DashboardService(
        IUnitOfWork unitOfWork,
        ITeamScopeService teamScopeService,
        IUserAccessRepository userAccess,
        IMapper mapper,
        TimeZoneInfo attendanceTimeZone,
        IAttendanceDeductionSweepService deductionSweep) : IDashboardService
    {
        public async Task<EmployeeDashboardDto> GetDashboardAsync(int userId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var user = await unitOfWork.GetRepository<DomainLayer.Models.UserModule.User, int>()
                .GetByIdAsync(new UserByIdSpec(userId), cancellationToken)
                ?? throw new DomainLayer.Exceptions.NotFoundException("User not found.");

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeSummaryByUserIdSpec(userId), cancellationToken);

            // Greeting and "today" follow the gym-local clock, not the server clock.
            var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone);
            var greeting = localNow.Hour < 12 ? "Good morning"
                : localNow.Hour < 17 ? "Good afternoon"
                : "Good evening";

            var userDto = employee is not null
                ? mapper.Map<DashboardUserDto>(employee)
                : new DashboardUserDto { FirstName = user.UserName };

            if (employee is null)
            {
                return Empty(greeting, userDto);
            }

            var today = DateOnly.FromDateTime(localNow);
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
                todayAttendance = new DashboardAttendanceDto
                {
                    CheckIn = ToLocalPunch(record.CheckInTime),
                    CheckOut = ToLocalPunch(record.CheckOutTime),
                    CheckedIn = record.CheckInTime is not null,
                    Status = record.Status.ToString(),
                    Source = record.CheckInMethod?.ToString() ?? string.Empty
                };
            }

            // Month summary — derived, not just stored records.
            // A scheduled employee who never punched is absent (like the management grid's
            // DeriveRow), but approved day-offs and leave/suspended employees are excluded.
            // Uses HashSet lookups so the per-day loop stays O(days in month) ≈ 31 max.
            var monthStart = new DateOnly(today.Year, today.Month, 1);
            var monthEnd = monthStart.AddMonths(1);
            var monthRecords = (await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeeSpec(employee.Id, monthStart), cancellationToken)).ToList();

            var monthAssignments = (await unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetAllAsync(new AssignmentsByEmployeeRangeSpec(employee.Id, monthStart, monthEnd.AddDays(-1)), cancellationToken))
                .ToLookup(a => a.Date);

            // O(1) day-off date lookups instead of .Any() per calendar day.
            var dayOffDates = new HashSet<DateOnly>();
            var approvedDayOffRequests = (await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new ApprovedDayOffRequestsByEmployeeIdsSpec(new[] { employee.Id }, monthStart, monthEnd.AddDays(-1)), cancellationToken))
                .ToList();
            foreach (var r in approvedDayOffRequests)
            {
                var start = r.TargetStartDate ?? r.RequestDate;
                var end = r.TargetEndDate ?? r.RequestDate;
                for (var d = start; d <= end; d = d.AddDays(1))
                {
                    dayOffDates.Add(d);
                }
            }

            var recordedDates = monthRecords.Select(r => r.Date).ToHashSet();

            int derivedAbsent = 0;
            for (var date = monthStart; date <= today && date < monthEnd; date = date.AddDays(1))
            {
                var assignment = monthAssignments[date].FirstOrDefault(a => !IsOffAssignment(a));
                if (assignment is null) continue;               // not scheduled this day
                if (recordedDates.Contains(date)) continue;     // punched — stored record decides
                if (dayOffDates.Contains(date)) continue;       // approved day off
                if (employee.Status is EmployeeStatus.OnLeave or EmployeeStatus.Suspended) continue;
                derivedAbsent++;                                // scheduled, no punch → absent
            }

            var present = monthRecords.Count(r => r.Status is AttendanceStatus.OnTime or AttendanceStatus.Late);
            var late = monthRecords.Count(r => r.Status == AttendanceStatus.Late);
            var storedAbsent = monthRecords.Count(r =>
                r.Status == AttendanceStatus.Absent
                && monthAssignments[r.Date].Any(a => !IsOffAssignment(a)));
            var totalAbsent = storedAbsent + derivedAbsent;
            var totalDays = monthRecords.Count + derivedAbsent;

            // Raise (and reconcile) the month's attendance deductions — derived
            // absences and stored late/absent days — as priced pending candidates the
            // branch sees in Employees Performance → Deductions. Idempotent per day,
            // so a dashboard load never duplicates or re-prices a row.
            if (derivedAbsent + storedAbsent + late > 0)
            {
                await deductionSweep.SweepAsync(new[] { employee.Id }, monthStart, today, cancellationToken);
            }

            // 7-day schedule strip: two recent past days (so the check-in/check-out
            // clock times have context), today, and the next four upcoming days.
            // Every date gets a tile — assignments only exist for scheduled dates.
            var stripStart = today.AddDays(-2);
            var stripEnd = today.AddDays(4);
            var assignments = (await unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetAllAsync(new AssignmentsByEmployeeRangeSpec(employee.Id, stripStart, stripEnd), cancellationToken))
                .Where(a => a.Date >= stripStart)
                .GroupBy(a => a.Date)
                .ToDictionary(g => g.Key, g => g.OrderBy(a => a.ShiftTemplateId == null).First());
            var stripAttendance = (await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeeRangeSpec(employee.Id, stripStart, stripEnd), cancellationToken))
                .GroupBy(r => r.Date)
                .ToDictionary(g => g.Key, g => g.First());
            var upcoming = new List<ScheduleDayDto>();
            for (var date = stripStart; date <= stripEnd; date = date.AddDays(1))
            {
                assignments.TryGetValue(date, out var assignment);
                stripAttendance.TryGetValue(date, out var dayRecord);
                var template = assignment?.ShiftTemplate;
                upcoming.Add(new ScheduleDayDto
                {
                    Date = date,
                    DayName = date.DayOfWeek.ToString(),
                    ShiftName = template?.Name,
                    Start = template?.StartTime,
                    End = template?.EndTime,
                    IsOff = template is null,
                    IsToday = date == today,
                    CheckIn = ToLocalPunch(dayRecord?.CheckInTime),
                    CheckOut = ToLocalPunch(dayRecord?.CheckOutTime),
                });
            }

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
                    Rate = totalDays == 0 ? 0 : (int)Math.Round(present * 100.0 / totalDays),
                    Present = present,
                    Late = late,
                    Absent = totalAbsent,
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
                // Gym-wide strip is a manager view: only a Branch Manager of the
                // active gym gets it; a plain employee gets no overview block at all.
                var roleNames = await userAccess.GetGymRoleNamesAsync(user.Id, activeGymId, cancellationToken);
                if (!roleNames.Contains(RoleNames.BranchManager))
                    return null;

                scoped = (await unitOfWork.GetRepository<Employee, int>()
                    .GetAllAsync(new EmployeesByGymSpec(activeGymId), cancellationToken)).ToList();
                scope = "branch";
            }

            var scopedIds = scoped.Select(e => e.Id).ToArray();
            var attendance = (await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeesDateSpec(scopedIds, today), cancellationToken)).ToList();
            var requests = await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new RequestsByEmployeesSpec(scopedIds), cancellationToken);

            // Stored records only cover employees who actually punched. A scheduled
            // employee with no record is absent, exactly like the attendance grid's
            // DeriveRow: exempt suspended employees, approved day-offs and on-leave.
            var assignments = await unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetAllAsync(new AssignmentsByEmployeesDateSpec(scopedIds, today), cancellationToken);
            var scheduledToday = assignments
                .Where(a => a.ShiftTemplateId is not null)
                .Select(a => a.EmployeeId)
                .Distinct()
                .ToHashSet();
            var recordedIds = attendance.Select(a => a.EmployeeId).ToHashSet();
            var dayOffIds = (await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new ApprovedDayOffRequestsByEmployeeIdsSpec(scopedIds, today, today), cancellationToken))
                .Select(r => r.EmployeeId)
                .ToHashSet();
            var derivedAbsentEmployees = scoped
                .Where(e =>
                    scheduledToday.Contains(e.Id)
                    && !recordedIds.Contains(e.Id)
                    && !dayOffIds.Contains(e.Id)
                    && e.Status is not EmployeeStatus.OnLeave
                    && e.Status is not EmployeeStatus.Suspended)
                .ToList();

            var derivedAbsent = derivedAbsentEmployees.Count;

            // Auto-deduction sweep across the month: derived absences and stored
            // late/absent days become priced pending candidates the manager reviews
            // (and approves / re-prices / rejects) in Employees Performance →
            // Deductions. Idempotent per day, so every dashboard load is safe.
            var monthStart = new DateOnly(today.Year, today.Month, 1);
            await deductionSweep.SweepAsync(scopedIds, monthStart, today, cancellationToken);

            return new DashboardOverviewDto
            {
                Scope = scope,
                MemberCount = scoped.Count,
                PresentToday = attendance.Count(a => a.Status == AttendanceStatus.OnTime || a.Status == AttendanceStatus.Late),
                PendingRequests = requests.Count(r => r.Status == RequestStatus.Pending || r.Status == RequestStatus.PendingHRReview),
                Absent = attendance.Count(a => a.Status == AttendanceStatus.Absent) + derivedAbsent
            };
        }

        private async Task<IReadOnlyList<int>> AllGymPeriodIdsAsync(int gymId, CancellationToken cancellationToken)
        {
            var periods = await unitOfWork.GetRepository<DomainLayer.Models.PayrollModule.PayrollPeriod, int>()
                .GetAllAsync(new PayrollPeriodsByGymSpec(gymId), cancellationToken);
            return periods.Select(p => p.Id).ToList();
        }

        /// <summary>
        /// Punches are stored as UTC instants; the dashboard renders them on the
        /// gym-local (Egypt) clock, exactly like the attendance grid.
        /// </summary>
        private TimeOnly? ToLocalPunch(DateTime? utcMoment)
        {
            if (utcMoment is null)
            {
                return null;
            }

            var local = TimeZoneInfo.ConvertTimeFromUtc(
                DateTime.SpecifyKind(utcMoment.Value, DateTimeKind.Utc), attendanceTimeZone);
            return TimeOnly.FromDateTime(local);
        }

        private static bool IsOffAssignment(ShiftAssignment assignment) =>
            assignment.ShiftTemplateId is null
            || assignment.ShiftTemplate is null
            || assignment.ShiftTemplate.Name.Contains("off", StringComparison.OrdinalIgnoreCase);

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
