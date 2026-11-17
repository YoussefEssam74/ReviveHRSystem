using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.SchedulingModule;

namespace Service.Services
{
    /// <summary>
    /// One pricing path for attendance/manager deductions: the sheet covering the
    /// punished day prices it, else the latest earlier sheet, else the salary
    /// history. The daily rate always divides by a fixed 30-day month. Shared by the
    /// attendance sweep and the branch /
    /// team-action flows so the same day never carries two different amounts.
    /// </summary>
    internal static class DeductionPricing
    {
        internal const int StandardDays = 30;

        internal static bool IsOffAssignment(ShiftAssignment assignment) =>
            assignment.ShiftTemplateId is null
            || assignment.ShiftTemplate is null
            || assignment.ShiftTemplate.Name.Contains("off", StringComparison.OrdinalIgnoreCase);

        /// <summary>Distinct non-off scheduled days inside the month.</summary>
        internal static int ScheduledWorkdays(
            int employeeId, DateOnly start, DateOnly end, IReadOnlyList<ShiftAssignment> assignments) =>
            assignments
                .Where(a => a.EmployeeId == employeeId
                    && a.Date >= start && a.Date <= end
                    && !IsOffAssignment(a))
                .Select(a => a.Date)
                .Distinct()
                .Count();

        /// <summary>
        /// Salary source order: the sheet covering the day → the latest earlier sheet →
        /// the latest effective compensation → 0 (the branch prices manually).
        /// </summary>
        internal static decimal SalaryFor(Employee employee, DateOnly date, IReadOnlyList<PayrollEntry> sheets)
        {
            var covering = sheets.FirstOrDefault(s =>
                s.BaseSalary > 0 && s.PayrollPeriod is not null
                && s.PayrollPeriod.StartDate <= date && date <= s.PayrollPeriod.EndDate);
            if (covering is not null)
            {
                return covering.BaseSalary;
            }

            var prior = sheets
                .Where(s => s.BaseSalary > 0 && s.PayrollPeriod is not null && s.PayrollPeriod.EndDate < date)
                .OrderByDescending(s => s.PayrollPeriod!.EndDate)
                .FirstOrDefault();
            if (prior is not null)
            {
                return prior.BaseSalary;
            }

            var compensation = employee.Compensations
                .Where(c => c.Amount > 0 && c.EffectiveDate <= date)
                .OrderByDescending(c => c.EffectiveDate)
                .FirstOrDefault()
                ?? employee.Compensations
                    .Where(c => c.Amount > 0)
                    .OrderByDescending(c => c.EffectiveDate)
                    .FirstOrDefault();

            return compensation?.Amount ?? 0m;
        }

        /// <summary>
        /// The day's rate and the divisor it used. A zero daily rate means no salary
        /// source is on file yet — the caller decides whether to block or leave the
        /// amount pending.
        /// </summary>
        internal static (decimal Daily, int Divisor) DailyRate(
            Employee employee,
            DateOnly date,
            IReadOnlyList<PayrollEntry> sheets,
            IReadOnlyList<ShiftAssignment> assignments)
        {
            var baseSalary = SalaryFor(employee, date, sheets);
            return (baseSalary > 0 ? Math.Round(baseSalary / StandardDays, 2) : 0m, StandardDays);
        }
    }
}
