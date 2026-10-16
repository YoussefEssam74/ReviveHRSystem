using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Self-service attendance reads (mock §6): month records, today's state and the
    /// summary counters, plus the leave-balance card. Records are mapped from
    /// AttendanceRecord (biometric/manual) cross-checked against shift assignments.
    /// </summary>
    public class AttendanceSelfService(
        IUnitOfWork unitOfWork,
        IEmployeeAccessService employeeAccess,
        IMapper mapper) : IAttendanceSelfService
    {
        public async Task<AttendanceOverviewDto> GetAttendanceAsync(
            int actorUserId, int employeeId, string? month, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

            var records = await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeeSpec(employeeId, ParseMonth(month)), cancellationToken);

            var items = records
                .OrderByDescending(r => r.Date)
                .Select(r => mapper.Map<AttendanceRecordDto>(r))
                .ToList();

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            return new AttendanceOverviewDto
            {
                Summary = Summarize(items),
                Today = items.FirstOrDefault(r => r.Date == today),
                Records = items
            };
        }

        public async Task<LeaveBalanceOverviewDto> GetLeaveBalanceAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

            var year = DateTime.UtcNow.Year;
            var balances = await unitOfWork.GetRepository<LeaveBalance, int>()
                .GetAllAsync(new LeaveBalancesByEmployeeSpec(employeeId, year), cancellationToken);

            return new LeaveBalanceOverviewDto
            {
                Year = year,
                Balances = balances.ToDictionary(
                    b => b.LeaveType.ToString(),
                    b => mapper.Map<LeaveBalanceDto>(b))
            };
        }

        private static DateOnly ParseMonth(string? month) =>
            DateOnly.TryParseExact($"{month}-01", "yyyy-MM-dd", out var parsed)
                ? new DateOnly(parsed.Year, parsed.Month, 1)
                : new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);

        private static AttendanceSummaryDto Summarize(IReadOnlyList<AttendanceRecordDto> records)
        {
            var total = records.Count;
            var present = records.Count(r => r.Status is "OnTime" or "Present" or "On Time");
            var late = records.Count(r => r.Status == "Late");
            var absent = records.Count(r => r.Status == "Absent");
            var early = records.Count(r => r.Status is "EarlyCheckout" or "Early Checkout");

            return new AttendanceSummaryDto
            {
                Rate = total == 0 ? 0 : (int)Math.Round((present + late) * 100.0 / total),
                Present = present,
                Late = late,
                Absent = absent,
                EarlyCheckout = early,
                MissingCheckout = records.Count(r => r.CheckIn is not null && r.CheckOut is null)
            };
        }
    }
}
