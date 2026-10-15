using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.RequestModule;
using Service.Specifications;

namespace Service.Services
{
    /// <summary>
    /// Leave-balance bookkeeping shared by the two places that move a request through
    /// its states: the self-service side (submit reserves, cancel releases) and the
    /// management side (a stage-1 rejection releases). A request submits pending days
    /// immediately, so a pending request blocks its days; HR's final approval consumes
    /// them into <see cref="LeaveBalance.UsedDays"/> when the HR portal decision lands.
    /// </summary>
    internal static class LeaveBalanceReservation
    {
        /// <summary>Entitlement a fresh balance row starts with when HR granted none.</summary>
        internal static decimal DefaultEntitlement(LeaveType leaveType) => leaveType switch
        {
            LeaveType.Annual => 21,
            LeaveType.Sick => 10,
            LeaveType.Emergency => 6,
            _ => 0
        };

        /// <summary>Leave type a request consumes, or null when it consumes none.</summary>
        internal static LeaveType? LeaveTypeFor(EmployeeRequest request) =>
            RequestTypeCatalog.LeaveTypeFor(request.Type);

        /// <summary>Calendar days a request covers (a single-day request covers one).</summary>
        internal static decimal DaysRequested(EmployeeRequest request)
        {
            if (request.TargetStartDate is null)
            {
                return 1;
            }

            var end = request.TargetEndDate ?? request.TargetStartDate;
            return end.Value.DayNumber - request.TargetStartDate.Value.DayNumber + 1;
        }

        /// <summary>
        /// Adds (or subtracts, for negative days) reserved pending days on the employee's
        /// balance for the current year, creating the row with the type's default
        /// entitlement when this is the first request of the year for that type.
        /// </summary>
        internal static async Task AdjustPendingDaysAsync(
            IUnitOfWork unitOfWork, int employeeId, LeaveType leaveType, decimal days,
            CancellationToken cancellationToken)
        {
            var year = DateTime.UtcNow.Year;
            var balances = await unitOfWork.GetRepository<LeaveBalance, int>()
                .GetAllAsync(new LeaveBalancesByEmployeeSpec(employeeId, year), cancellationToken);

            var balance = balances.FirstOrDefault(b => b.LeaveType == leaveType);
            var isNew = balance is null;
            if (isNew)
            {
                balance = new LeaveBalance
                {
                    EmployeeId = employeeId,
                    LeaveType = leaveType,
                    Year = year,
                    TotalEntitlement = DefaultEntitlement(leaveType),
                    UsedDays = 0,
                    PendingDays = 0
                };
                await unitOfWork.GetRepository<LeaveBalance, int>().AddAsync(balance, cancellationToken);
            }

            balance!.PendingDays = Math.Max(0, balance.PendingDays + days);

            // Only existing rows need an explicit Update; new rows are already tracked as Added.
            if (!isNew)
            {
                unitOfWork.GetRepository<LeaveBalance, int>().Update(balance);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        /// <summary>
        /// Days still available to request for a leave type: entitlement minus consumed
        /// minus already-reserved pending days. Reads without creating anything.
        /// </summary>
        internal static async Task<decimal> RemainingDaysAsync(
            IUnitOfWork unitOfWork, int employeeId, LeaveType leaveType, CancellationToken cancellationToken)
        {
            var year = DateTime.UtcNow.Year;
            var balances = await unitOfWork.GetRepository<LeaveBalance, int>()
                .GetAllAsync(new LeaveBalancesByEmployeeSpec(employeeId, year), cancellationToken);

            var balance = balances.FirstOrDefault(b => b.LeaveType == leaveType);
            var entitlement = balance?.TotalEntitlement ?? DefaultEntitlement(leaveType);

            return entitlement - (balance?.UsedDays ?? 0) - (balance?.PendingDays ?? 0);
        }

        /// <summary>
        /// Refuses a submission whose days exceed what the employee has left, so the
        /// employee can never lock more days than his entitlement allows.
        /// </summary>
        internal static async Task EnsureDaysAvailableAsync(
            IUnitOfWork unitOfWork, int employeeId, LeaveType leaveType, decimal days,
            CancellationToken cancellationToken)
        {
            var remaining = await RemainingDaysAsync(unitOfWork, employeeId, leaveType, cancellationToken);
            if (days > remaining)
            {
                throw new BadRequestException(
                    $"This request covers {days} day(s) but only {remaining} {leaveType} day(s) remain — you cannot submit more than your remaining balance.");
            }
        }
    }
}
