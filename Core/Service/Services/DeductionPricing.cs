using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.SchedulingModule;

namespace Service.Services
{
    /// <summary>
    /// The two rates a deduction is priced from, both derived from the salary and the
    /// published schedule of the month the punished day belongs to:
    ///   • daily = base ÷ the month's calendar days (28/29/30/31);
    ///   • hourly = base ÷ the hours actually assigned that month.
    /// Nothing is priced from a fixed 30-day month any more, and a manager sizes the
    /// deduction in hours or days — the money follows the unit.
    /// </summary>
    internal static class DeductionPricing
    {
        internal static bool IsOffAssignment(ShiftAssignment assignment) =>
            assignment.ShiftTemplateId is null
            || assignment.ShiftTemplate is null
            || assignment.ShiftTemplate.Name.Contains("off", StringComparison.OrdinalIgnoreCase);

        /// <summary>Hours one assignment lasts; an overnight shift wraps past midnight.</summary>
        internal static decimal ShiftHours(ShiftTemplate? template)
        {
            if (template is null)
            {
                return 0m;
            }

            var minutes = template.EndTime.ToTimeSpan() - template.StartTime.ToTimeSpan();
            if (minutes <= TimeSpan.Zero)
            {
                minutes += TimeSpan.FromDays(1);
            }

            return (decimal)minutes.TotalHours;
        }

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
        /// The month's rates. The hourly rate only exists once the roster is complete —
        /// the whole salary is spread over the month's assigned hours, so a half-assigned
        /// month would price an hour too high.
        /// </summary>
        internal static DeductionRates Rates(
            Employee employee,
            DateOnly date,
            IReadOnlyList<PayrollEntry> sheets,
            IReadOnlyList<ShiftAssignment> assignments)
        {
            var salary = SalaryFor(employee, date, sheets);
            var monthDays = DateTime.DaysInMonth(date.Year, date.Month);
            var daily = salary > 0 ? Math.Round(salary / monthDays, 2) : 0m;

            var monthAssignments = assignments
                .Where(a => a.EmployeeId == employee.Id && a.Date.Year == date.Year && a.Date.Month == date.Month)
                .ToList();
            var assignedHours = monthAssignments
                .Where(a => !IsOffAssignment(a))
                .Sum(a => ShiftHours(a.ShiftTemplate));
            var rosterComplete = monthAssignments.Select(a => a.Date).Distinct().Count() >= monthDays;
            var hourly = salary > 0 && assignedHours > 0
                ? Math.Round(salary / assignedHours, 2)
                : 0m;

            return new DeductionRates(daily, hourly, monthDays, assignedHours, salary > 0, rosterComplete);
        }

        /// <summary>Daily rate of a payroll period: base ÷ its calendar days.</summary>
        internal static decimal PeriodDailyRate(decimal baseSalary, DateOnly start, DateOnly end)
        {
            var days = end.DayNumber - start.DayNumber + 1;
            return baseSalary > 0 && days > 0 ? Math.Round(baseSalary / days, 2) : 0m;
        }
    }

    /// <summary>
    /// The rates of one punished day plus their completeness: <see cref="HourlyKnown"/> is
    /// false until the month's roster is fully assigned, which is why an hours-based
    /// deduction can stay unpriced for a while and fill in by itself later.
    /// </summary>
    internal readonly record struct DeductionRates(
        decimal Daily,
        decimal Hourly,
        int MonthDays,
        decimal AssignedHours,
        bool Salaried,
        bool RosterComplete)
    {
        public bool HourlyKnown => Salaried && RosterComplete && AssignedHours > 0;

        /// <summary>The money a size costs at these rates; 0 while the rate is unknown.</summary>
        public decimal AmountFor(DeductionUnit unit, decimal value) =>
            value <= 0
                ? 0m
                : unit == DeductionUnit.Hours
                    ? HourlyKnown ? Math.Round(value * Hourly, 2) : 0m
                    : Salaried ? Math.Round(value * Daily, 2) : 0m;

        /// <summary>The same size in salary days (hours are converted through both rates).</summary>
        public decimal DaysFor(DeductionUnit unit, decimal value) =>
            unit == DeductionUnit.Days
                ? value
                : HourlyKnown && Daily > 0
                    ? Math.Round(value * Hourly / Daily, 2)
                    : 0m;

        /// <summary>Why an amount is still missing, or null when it is priced.</summary>
        public string? PendingReason(DeductionUnit unit) =>
            !Salaried
                ? "No salary on file — add a salary or compensation before this deduction can be priced."
                : unit == DeductionUnit.Hours && !HourlyKnown
                    ? "Waiting for the month's roster: the hourly rate needs every day assigned."
                    : null;

        /// <summary>
        /// The one wording every surface shows for a deduction: what is missing, what to
        /// do next, or the arithmetic the amount came from.
        /// </summary>
        public string Note(DeductionUnit unit, decimal value)
        {
            if (value <= 0)
            {
                return "Awaiting the branch manager — choose the deduction in hours or days.";
            }

            if (PendingReason(unit) is { } pending)
            {
                return pending;
            }

            var hours = unit == DeductionUnit.Hours;
            var rate = hours ? Hourly : Daily;
            var basis = hours
                ? $"{AssignedHours:0.##} assigned hours this month"
                : $"{MonthDays} calendar days";
            return $"Priced: {value:0.##} {(hours ? "h" : "day(s)")} × {rate:0.00} (base ÷ {basis}).";
        }
    }
}
