using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Branch/team attendance day view (mock Â§22). Scope: the caller's team when
    /// team-scoped in the active gym, otherwise the gym (ADR-003 Amendment 1).
    /// </summary>
    public class AttendanceManagementService(
        IUnitOfWork unitOfWork,
        ITeamScopeService teamScopeService) : IAttendanceManagementService
    {
        public async Task<AttendanceManagementDto> GetDayAsync(
            int actorUserId, int? activeGymId, DateOnly? date, CancellationToken cancellationToken = default)
        {
            var gymId = activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");
            var day = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var employees = await LoadScopedAsync(actorUserId, gymId, cancellationToken);
            var ids = employees.Select(e => e.Id).ToList();

            var records = await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeesDateSpec(ids, day), cancellationToken);
            var byEmployee = records.ToLookup(r => r.EmployeeId);

            // Scheduled-with-a-real-shift today: needed to detect no-shows (no record).
            var assignments = await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(new AssignmentsByEmployeesDateSpec(ids, day), cancellationToken);
            var scheduled = assignments
                .Where(a => a.ShiftTemplateId is not null)
                .ToLookup(a => a.EmployeeId);

            var late = new List<AttendancePersonDto>();
            var absent = new List<AttendancePersonDto>();
            var missing = new List<AttendancePersonDto>();
            var present = 0;

            foreach (var employee in employees)
            {
                var person = new AttendancePersonDto
                {
                    EmployeeId = employee.Id,
                    Name = employee.FullName,
                    Position = employee.Position?.Title ?? string.Empty
                };

                var record = byEmployee[employee.Id].FirstOrDefault();
                if (record is not null)
                {
                    person = new AttendancePersonDto
                    {
                        EmployeeId = person.EmployeeId,
                        Name = person.Name,
                        Position = person.Position,
                        CheckIn = record.CheckInTime.HasValue ? (TimeOnly?)TimeOnly.FromDateTime(record.CheckInTime.Value) : null,
                        LateMinutes = record.Status == AttendanceStatus.Late
                            && record.CheckInTime.HasValue
                            && record.ScheduledShiftTemplate is not null
                            ? Math.Max(0, (int)(record.CheckInTime.Value.TimeOfDay - record.ScheduledShiftTemplate.StartTime.ToTimeSpan()).TotalMinutes)
                            : (int?)null
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

                    continue;
                }

                // No record at all: a scheduled employee is a no-show (absent).
                if (scheduled[employee.Id].Any())
                {
                    absent.Add(person);
                }
            }

            return new AttendanceManagementDto
            {
                Date = day,
                Summary = new AttendanceCountsDto
                {
                    Present = present,
                    Late = late.Count,
                    Absent = absent.Count,
                    MissingCheckout = missing.Count
                },
                Late = late,
                Absent = absent,
                MissingCheckout = missing
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
