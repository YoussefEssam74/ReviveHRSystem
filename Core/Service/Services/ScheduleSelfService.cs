using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.SchedulingModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Published-schedule reads for one employee (mock §7; roles guide: employees see
    /// published cycles only). Assignments come from published ShiftCycles in the
    /// employee's gym; off days are assignments without a shift template.
    /// </summary>
    public class ScheduleSelfService(
        IUnitOfWork unitOfWork,
        IEmployeeAccessService employeeAccess,
        IMapper mapper,
        TimeZoneInfo attendanceTimeZone) : IScheduleSelfService
    {
        public async Task<EmployeeScheduleDto> GetScheduleAsync(
            int actorUserId,
            int employeeId,
            string? month,
            string? from,
            string? to,
            int? activeGymId,
            CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, activeGymId, cancellationToken);

            var employee = await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            // "Today" and the default month follow the organization's timezone, not
            // the host/UTC clock: a UTC month is still the previous day between
            // midnight and the UTC offset (e.g. 00:00–02:00 in Cairo), which used to
            // highlight the wrong "today" and request the wrong month on the 1st.
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone));
            var monthStart = ParseMonth(month, today);
            var (windowStart, windowEndExclusive) = ResolveWindow(from, to, monthStart);

            var cycles = (await unitOfWork.GetRepository<ShiftCycle, int>()
                .GetAllAsync(new PublishedCyclesByGymSpec(employee.GymId, windowStart, windowEndExclusive), cancellationToken))
                .ToList();

            var cycleIds = cycles.Select(c => c.Id).ToList();
            var assignments = await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(new ScheduleAssignmentsByEmployeeSpec(employee.Id, cycleIds), cancellationToken);

            // A published cycle may straddle the requested window (e.g. Mon Oct 26 –
            // Sun Nov 1 seen through the November window). The page checking "is
            // every cycle date assigned?" compares against a local week that
            // crosses the boundary, so cutting Days at the window edge turned
            // boundary dates into false "no assigned shift" days that no amount
            // of re-assigning could clear. Days therefore carry the full ranges
            // of every returned cycle instead of the window cut.
            var days = assignments
                .OrderBy(a => a.Date)
                .Select(a => mapper.Map<ScheduleDayDto>(a, opts => opts.Items["today"] = today))
                .ToList();

            return new EmployeeScheduleDto
            {
                Month = windowStart.ToString("yyyy-MM"),
                Cycles = cycles
                    .OrderBy(c => c.StartDate)
                    .Select(c => mapper.Map<ScheduleCycleDto>(c))
                    .ToList(),
                Days = days
            };
        }

        /// <summary>
        /// Explicit yyyy-MM-dd range (inclusive) when the caller supplies one,
        /// otherwise the calendar month. The range is what the profile's current-week
        /// tab asks for, so a week that straddles a month boundary resolves both
        /// months' cycles.
        /// </summary>
        private static (DateOnly Start, DateOnly EndExclusive) ResolveWindow(
            string? from, string? to, DateOnly monthStart)
        {
            if (string.IsNullOrWhiteSpace(from) && string.IsNullOrWhiteSpace(to))
            {
                return (monthStart, monthStart.AddMonths(1));
            }

            var start = ParseOptionalDate(from, "from") ?? monthStart;
            var endInclusive = ParseOptionalDate(to, "to") ?? start;
            if (endInclusive < start)
            {
                throw new BadRequestException("'to' must be on or after 'from'.");
            }

            return (start, endInclusive.AddDays(1));
        }

        private static DateOnly? ParseOptionalDate(string? value, string field)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return DateOnly.TryParseExact(value, "yyyy-MM-dd", out var parsed)
                ? parsed
                : throw new BadRequestException($"{field} must be a valid date in yyyy-MM-dd format.");
        }

        private static DateOnly ParseMonth(string? month, DateOnly today) =>
            DateOnly.TryParseExact($"{month}-01", "yyyy-MM-dd", out var parsed)
                ? new DateOnly(parsed.Year, parsed.Month, 1)
                : new DateOnly(today.Year, today.Month, 1);
    }
}
