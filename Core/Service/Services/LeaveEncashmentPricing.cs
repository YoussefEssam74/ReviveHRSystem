using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using Service.Specifications;

namespace Service.Services
{
    /// <summary>
    /// One employee's exit-entitlement picture: the priced result plus the inputs it
    /// was derived from, so the UI can explain the arithmetic.
    /// </summary>
    internal readonly record struct LeaveEncashmentQuote(
        LeaveEncashmentCalculator.Result Result,
        decimal UsedDays,
        decimal BaseSalary,
        bool BelowQualifyingPeriod);

    /// <summary>
    /// Loads what <see cref="LeaveEncashmentCalculator"/> needs and writes the result
    /// onto the exit case / payroll sheet. Shared by the separations service (verdict)
    /// and the payroll service (closing the final sheet after every request is decided).
    /// </summary>
    internal static class LeaveEncashmentPricing
    {
        internal static async Task<LeaveEncashmentQuote> QuoteAsync(
            IUnitOfWork unitOfWork, OffboardingCase kase, CancellationToken cancellationToken)
        {
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(kase.EmployeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            var year = kase.LastWorkingDate.Year;
            var balances = await unitOfWork.GetRepository<LeaveBalance, int>()
                .GetAllAsync(new LeaveBalancesByEmployeeSpec(employee.Id, year), cancellationToken);
            var usedDays = balances.FirstOrDefault(b => b.LeaveType == LeaveType.Annual)?.UsedDays ?? 0m;

            // Days HR deliberately settled unpaid never entered UsedDays.
            var requests = await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new RequestsByEmployeeSpec(employee.Id), cancellationToken);
            var unpaidSettledDays = requests
                .Where(r => r.RequestDate.Year == year
                    && r.Status == RequestStatus.Approved
                    && LeaveBalanceReservation.LeaveTypeFor(r) is not null
                    && string.Equals(r.Payment, "unpaid", StringComparison.OrdinalIgnoreCase))
                .Sum(LeaveBalanceReservation.DaysRequested);

            var salary = employee.Compensations
                .Where(c => c.Amount > 0 && c.EffectiveDate <= kase.LastWorkingDate)
                .OrderByDescending(c => c.EffectiveDate)
                .FirstOrDefault()?.Amount
                ?? employee.Compensations
                    .Where(c => c.Amount > 0)
                    .OrderByDescending(c => c.EffectiveDate)
                    .FirstOrDefault()?.Amount
                ?? 0m;

            // No grant on file: fall back to the payroll sheet, the same source order the
            // deduction pricing uses, so an employee with only payroll history is priced.
            if (salary <= 0)
            {
                var sheets = await unitOfWork.GetRepository<PayrollEntry, int>()
                    .GetAllAsync(new PayrollEntriesForSalarySpec(employee.Id), cancellationToken);
                var covering = sheets.FirstOrDefault(s =>
                    s.PayrollPeriod.StartDate <= kase.LastWorkingDate
                    && kase.LastWorkingDate <= s.PayrollPeriod.EndDate);
                salary = covering?.BaseSalary ?? sheets.FirstOrDefault()?.BaseSalary ?? 0m;
            }

            var result = LeaveEncashmentCalculator.Calculate(
                employee.HireDate, kase.LastWorkingDate, usedDays, unpaidSettledDays, salary);

            return new LeaveEncashmentQuote(
                result,
                usedDays,
                salary,
                AnnualLeaveAccrual.CompletedServiceMonths(employee.HireDate, kase.LastWorkingDate)
                    < AnnualLeaveAccrual.QualifyingMonths);
        }

        /// <summary>Prices the exit and stores all six figures on the case.</summary>
        internal static async Task<LeaveEncashmentQuote> ApplyAsync(
            IUnitOfWork unitOfWork, OffboardingCase kase, CancellationToken cancellationToken)
        {
            var quote = await QuoteAsync(unitOfWork, kase, cancellationToken);
            var result = quote.Result;

            kase.LeaveEarnedDaysThisYear = result.EarnedDaysThisYear;
            kase.LeaveEncashmentDays = result.UnusedDays;
            kase.LeaveEncashmentDailyRate = result.DailyRate;
            kase.LeaveEncashmentAmount = result.EncashmentAmount;
            kase.UnpaidLeaveDays = result.DeficitDays;
            kase.UnpaidLeaveAmount = result.DebtAmount;

            return quote;
        }

        /// <summary>
        /// Mirrors the stored encashment onto the final payroll sheet. When the exit
        /// month's sheet does not exist yet it is created here, so the amount is
        /// visible the moment the verdict is recorded instead of waiting for the
        /// branch to generate that month's payroll.
        /// </summary>
        internal static async Task SyncToPayrollAsync(
            IUnitOfWork unitOfWork, OffboardingCase kase, CancellationToken cancellationToken)
        {
            if (kase.Employee is null)
            {
                return;
            }

            var periods = await unitOfWork.GetRepository<PayrollPeriod, int>()
                .GetAllAsync(new PayrollPeriodsByGymIncludingOpenSpec(kase.Employee.GymId), cancellationToken);
            var period = periods.FirstOrDefault(p =>
                p.StartDate <= kase.LastWorkingDate
                && kase.LastWorkingDate <= p.EndDate
                && p.Status == PayrollPeriodStatus.Open
                && p.PaidDate is null);
            if (period is null)
            {
                return;
            }

            var entry = await unitOfWork.GetRepository<PayrollEntry, int>()
                .GetByIdAsync(new PayrollEntryForEmployeeSpec(period.Id, kase.EmployeeId), cancellationToken);
            if (entry is null)
            {
                entry = await PayrollService.EnsureEntryAsync(unitOfWork, period, kase.Employee, cancellationToken);
            }

            entry.LeaveEncashment = kase.LeaveEncashmentAmount ?? 0m;
            entry.LeaveEncashmentDays = kase.LeaveEncashmentDays ?? 0m;
            PayrollService.SyncTotals(entry);
            unitOfWork.GetRepository<PayrollEntry, int>().Update(entry);
        }
    }
}
