using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.SchedulingModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;
using DomainLayer.Models.UserModule.Enums;

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
        IMapper mapper) : IScheduleSelfService
    {
        public async Task<EmployeeScheduleDto> GetScheduleAsync(
            int actorUserId, int employeeId, string? month, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, activeGymId, cancellationToken);

            var employee = await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new DomainLayer.Exceptions.NotFoundException("Employee not found.");

            var monthStart = ParseMonth(month);
            var monthEnd = monthStart.AddMonths(1);

            var cycles = await unitOfWork.GetRepository<ShiftCycle, int>()
                .GetAllAsync(new PublishedCyclesByGymSpec(employee.GymId, monthStart, monthEnd), cancellationToken);

            var cycleIds = cycles.Select(c => c.Id).ToList();
            var assignments = await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(new ScheduleAssignmentsByEmployeeSpec(employee.Id, cycleIds), cancellationToken);

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var days = assignments
                .Where(a => a.Date >= monthStart && a.Date < monthEnd)
                .OrderBy(a => a.Date)
                .Select(a => mapper.Map<ScheduleDayDto>(a, opts => opts.Items["today"] = today))
                .ToList();

            return new EmployeeScheduleDto
            {
                Month = monthStart.ToString("yyyy-MM"),
                Cycles = cycles
                    .OrderBy(c => c.StartDate)
                    .Select(c => mapper.Map<ScheduleCycleDto>(c))
                    .ToList(),
                Days = days
            };
        }

        private static DateOnly ParseMonth(string? month) =>
            DateOnly.TryParseExact($"{month}-01", "yyyy-MM-dd", out var parsed)
                ? new DateOnly(parsed.Year, parsed.Month, 1)
                : new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
    }
}
