using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;

namespace Service.Services
{
    /// <summary>
    /// Branch/team attendance day view (mock 22). Scope: the caller's team when
    /// team-scoped in the active gym, otherwise the gym (ADR-003 Amendment 1).
    /// A single day or an inclusive range can be requested: the exception lists
    /// cover the whole window and <see cref="AttendanceManagementDto.Roster"/> is the
    /// paged, filterable view of every in-scope person-day.
    /// </summary>
    public class AttendanceManagementService(
        IUnitOfWork unitOfWork,
        ITeamScopeService teamScopeService,
        TimeZoneInfo? attendanceTimeZone = null) : IAttendanceManagementService
    {
        private readonly TimeZoneInfo _attendanceTimeZone = attendanceTimeZone ?? TimeZoneInfo.Local;

        public async Task<AttendanceManagementDto> GetDayAsync(
            int actorUserId, int? activeGymId, AttendanceQueryParams query, CancellationToken cancellationToken = default)
        {
            var gymId = activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");
            var employees = await LoadScopedAsync(actorUserId, gymId, cancellationToken);

            // A single day is the default; DateFrom/DateTo widen the window, capped so a
            // full-range request cannot materialise every person-day of the scope.
            var from = query.DateFrom ?? query.Date
                ?? DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _attendanceTimeZone));
            var to = query.DateTo ?? query.Date ?? from;
            if (to < from)
            {
                (from, to) = (to, from);
            }

            if (to.DayNumber - from.DayNumber + 1 > AttendanceQueryParams.MaxRangeDays)
            {
                throw new BadRequestException(
                    $"The requested range is too wide. Ask for at most {AttendanceQueryParams.MaxRangeDays} days at a time.");
            }

            var days = Enumerable.Range(0, to.DayNumber - from.DayNumber + 1)
                .Select(offset => from.AddDays(offset))
                .ToList();

            var ids = employees.Select(e => e.Id).ToList();
            var records = await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeesRangeSpec(ids, from, to), cancellationToken);
            var byEmployeeDay = records.ToLookup(r => (r.EmployeeId, r.Date));

            // Scheduled-with-a-real-shift: needed to detect no-shows (no record).
            var assignments = await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(new AssignmentsByEmployeesRangeSpec(ids, from, to), cancellationToken);
            var scheduled = assignments
                .Where(a => a.ShiftTemplateId is not null)
                .ToLookup(a => (a.EmployeeId, a.Date));

            var scopedEmployees = query.EmployeeId is null
                ? employees
                : employees.Where(e => e.Id == query.EmployeeId).ToList();

            var late = new List<AttendancePersonDto>();
            var absent = new List<AttendancePersonDto>();
            var missing = new List<AttendancePersonDto>();
            var roster = new List<AttendancePersonDto>();
            var present = 0;

            foreach (var employee in scopedEmployees)
            {
                foreach (var day in days)
                {
                    var person = new AttendancePersonDto
                    {
                        EmployeeId = employee.Id,
                        Name = employee.FullName,
                        Position = employee.Position?.Title ?? string.Empty,
                        Date = day
                    };

                    var record = byEmployeeDay[(employee.Id, day)].FirstOrDefault();
                    if (record is not null)
                    {
                        TimeOnly? localCheckInTime = null;
                        int? lateMinutes = null;

                        if (record.CheckInTime.HasValue)
                        {
                            var localCheckIn = TimeZoneInfo.ConvertTimeFromUtc(record.CheckInTime.Value, _attendanceTimeZone);
                            localCheckInTime = TimeOnly.FromDateTime(localCheckIn);

                            if (record.Status == AttendanceStatus.Late && record.ScheduledShiftTemplate is not null)
                            {
                                lateMinutes = Math.Max(0, (int)(localCheckIn.TimeOfDay - record.ScheduledShiftTemplate.StartTime.ToTimeSpan()).TotalMinutes);
                            }
                        }

                        person = new AttendancePersonDto
                        {
                            EmployeeId = person.EmployeeId,
                            Name = person.Name,
                            Position = person.Position,
                            Date = day,
                            Status = record.Status.ToString(),
                            CheckIn = localCheckInTime,
                            LateMinutes = lateMinutes
                        };

                        switch (record.Status)
                        {
                            case AttendanceStatus.OnTime:
                                present++;
                                break;
                            case AttendanceStatus.Late:
                                late.Add(person);
                                present++;
                                break;
                            case AttendanceStatus.Absent:
                                absent.Add(person);
                                break;
                            case AttendanceStatus.MissingCheckout:
                            case AttendanceStatus.EarlyCheckout:
                                missing.Add(person);
                                present++;
                                break;
                        }
                    }
                    // No record at all: a scheduled employee is a no-show (absent).
                    else if (scheduled[(employee.Id, day)].Any())
                    {
                        var noShow = new AttendancePersonDto
                        {
                            EmployeeId = person.EmployeeId,
                            Name = person.Name,
                            Position = person.Position,
                            Date = day,
                            Status = AttendanceStatus.Absent.ToString()
                        };
                        absent.Add(noShow);
                        roster.Add(noShow);
                        continue;
                    }

                    roster.Add(person);
                }
            }

            var statusFiltered = string.IsNullOrWhiteSpace(query.Status)
                ? roster
                : roster.Where(p => string.Equals(
                    p.Status?.Replace(" ", string.Empty),
                    query.Status.Replace(" ", string.Empty),
                    StringComparison.OrdinalIgnoreCase)).ToList();

            var page = statusFiltered
                .Skip(query.SkipCount)
                .Take(query.PageSize)
                .ToList();

            return new AttendanceManagementDto
            {
                Date = from,
                DateFrom = from,
                DateTo = to,
                Summary = new AttendanceCountsDto
                {
                    Present = present,
                    Late = late.Count,
                    Absent = absent.Count,
                    MissingCheckout = missing.Count
                },
                Late = late,
                Absent = absent,
                MissingCheckout = missing,
                Roster = new PaginationResult<AttendancePersonDto>(query.PageNumber, query.PageSize, statusFiltered.Count, page)
            };
        }

        private async Task<List<Employee>> LoadScopedAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var ledTeamId = await teamScopeService.GetLedTeamIdAsync(actorUserId, gymId, cancellationToken);
            var employees = ledTeamId is not null
                ? await unitOfWork.GetRepository<Employee, int>().GetAllAsync(new EmployeesByTeamSpec(ledTeamId.Value), cancellationToken)
                : await unitOfWork.GetRepository<Employee, int>().GetAllAsync(new EmployeesByGymSpec(gymId), cancellationToken);
            return employees.ToList();
        }
    }
}
