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
            LeaveType.Sick => 10,
            LeaveType.Emergency => 6,
            // Annual is never a flat default: it accrues with completed service
            // (see AnnualLeaveAccrual). Callers must use EntitlementForAsync.
            _ => 0
        };

        /// <summary>
        /// The entitlement actually in force for one employee and leave type. Annual
        /// leave accrues from the hire date; every other type keeps its flat default.
        /// </summary>
        internal static async Task<decimal> EntitlementForAsync(
            IUnitOfWork unitOfWork, int employeeId, LeaveType leaveType, CancellationToken cancellationToken)
        {
            if (leaveType != LeaveType.Annual)
            {
                return DefaultEntitlement(leaveType);
            }

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken);

            return employee is null
                ? 0m
                : AnnualLeaveAccrual.EntitledDays(employee.HireDate, DateOnly.FromDateTime(DateTime.UtcNow));
        }

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
                    TotalEntitlement = await EntitlementForAsync(unitOfWork, employeeId, leaveType, cancellationToken),
                    UsedDays = 0,
                    PendingDays = 0
                };
                await unitOfWork.GetRepository<LeaveBalance, int>().AddAsync(balance, cancellationToken);
            }
            else if (leaveType == LeaveType.Annual)
            {
                // Keep the stored annual total in step with the accrual so any reader
                // that only sees the row (e.g. the inbox's balance-alert filter) agrees
                // with the entitlement the request paths enforce.
                balance.TotalEntitlement = await EntitlementForAsync(unitOfWork, employeeId, leaveType, cancellationToken);
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
        /// minus already-reserved pending days. Reads without creating anything. The
        /// entitlement is the one in force today, not the stale stored total.
        /// </summary>
        internal static async Task<decimal> RemainingDaysAsync(
            IUnitOfWork unitOfWork, int employeeId, LeaveType leaveType, CancellationToken cancellationToken)
        {
            var year = DateTime.UtcNow.Year;
            var balances = await unitOfWork.GetRepository<LeaveBalance, int>()
                .GetAllAsync(new LeaveBalancesByEmployeeSpec(employeeId, year), cancellationToken);

            var balance = balances.FirstOrDefault(b => b.LeaveType == leaveType);
            var entitlement = await EntitlementForAsync(unitOfWork, employeeId, leaveType, cancellationToken);

            return entitlement - (balance?.UsedDays ?? 0) - (balance?.PendingDays ?? 0);
        }

        /// <summary>
        /// Refuses a submission that would exceed the leave the employee may still take.
        ///
        /// Annual leave is capped by the year, not by the accrual: he may book up to the
        /// twelve days a full year earns even before they are all accrued ("12 days in one
        /// month"), and whatever exceeds the accrued balance is recorded as an unpaid day.
        /// The accrual still governs how many of those days are paid.
        /// </summary>
        internal static async Task EnsureDaysAvailableAsync(
            IUnitOfWork unitOfWork, int employeeId, LeaveType leaveType, decimal days,
            CancellationToken cancellationToken)
        {
            if (leaveType == LeaveType.Annual)
            {
                var year = DateTime.UtcNow.Year;
                var rows = await unitOfWork.GetRepository<LeaveBalance, int>()
                    .GetAllAsync(new LeaveBalancesByEmployeeSpec(employeeId, year), cancellationToken);
                var annual = rows.FirstOrDefault(b => b.LeaveType == LeaveType.Annual);
                var used = annual?.UsedDays ?? 0;

                // Booked days that are still waiting on a decision also hold their slots.
                var held = annual?.PendingDays ?? 0;
                var yearlyLeft = Math.Max(0m, AnnualLeaveAccrual.MaxDaysPerYear - used - held);
                if (days > yearlyLeft)
                {
                    throw new BadRequestException(
                        $"Annual leave is limited to {AnnualLeaveAccrual.MaxDaysPerYear} days a year — {yearlyLeft} day(s) left. " +
                        "Days beyond your accrued balance are recorded as unpaid.");
                }

                return;
            }

            var remaining = await RemainingDaysAsync(unitOfWork, employeeId, leaveType, cancellationToken);
            if (days > remaining)
            {
                var available = Math.Max(0m, remaining);
                throw new BadRequestException(
                    $"This request covers {days} day(s) but only {available} {leaveType} day(s) remain — you cannot submit more than your remaining balance.");
            }
        }
    }
}
