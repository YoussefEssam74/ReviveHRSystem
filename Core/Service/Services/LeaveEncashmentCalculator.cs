namespace Service.Services
{
    /// <summary>
    /// Annual-leave encashment at exit.
    ///
    /// The exit year is pro-rated to the calendar year: one day per month worked in
    /// that year, never more than the service-based accrual
    /// (<see cref="AnnualLeaveAccrual"/>) releases and never more than the yearly
    /// maximum. Leaving in April therefore pays four days — not the twelve a full
    /// year earns — and the six-month qualifying period still applies.
    ///
    /// Unused paid days are encashed; days taken beyond the earned balance (plus the
    /// days HR settled as unpaid) stay a separate debt so the two never net silently.
    /// </summary>
    internal static class LeaveEncashmentCalculator
    {
        internal readonly record struct Result(
            decimal EarnedDaysThisYear,
            decimal UnusedDays,
            decimal DeficitDays,
            decimal DailyRate,
            decimal EncashmentAmount,
            decimal DebtAmount);

        /// <summary>
        /// Months worked in the exit year, exit month included: hired 2023-05-01 and
        /// leaving 2026-04-20 → 4 (Jan–Apr). A mid-year hire counts from its hire month.
        /// </summary>
        internal static int MonthsWorkedInYear(DateOnly hireDate, DateOnly lastWorkingDay)
        {
            var yearStart = new DateOnly(lastWorkingDay.Year, 1, 1);
            var start = hireDate > yearStart ? hireDate : yearStart;
            if (lastWorkingDay < start)
            {
                return 0;
            }

            return Math.Clamp(
                ((lastWorkingDay.Year - start.Year) * 12) + (lastWorkingDay.Month - start.Month) + 1,
                0,
                AnnualLeaveAccrual.MaxDaysPerYear);
        }

        /// <summary>
        /// Days earned in the exit year: nothing before the qualifying period, then one
        /// per month worked this year, capped by both the yearly maximum and what the
        /// service-based accrual has released.
        /// </summary>
        internal static decimal EarnedDaysThisYear(DateOnly hireDate, DateOnly lastWorkingDay)
        {
            if (AnnualLeaveAccrual.CompletedServiceMonths(hireDate, lastWorkingDay) < AnnualLeaveAccrual.QualifyingMonths)
            {
                return 0m;
            }

            var monthsThisYear = MonthsWorkedInYear(hireDate, lastWorkingDay);
            var accrued = AnnualLeaveAccrual.EntitledDays(hireDate, lastWorkingDay);
            return Math.Min(AnnualLeaveAccrual.MaxDaysPerYear, Math.Min(monthsThisYear, accrued));
        }

        /// <summary>Base salary ÷ the exit month's calendar days — the rate the system already prices days at.</summary>
        internal static decimal DailyRate(decimal baseSalary, DateOnly lastWorkingDay) =>
            baseSalary > 0
                ? Math.Round(baseSalary / DateTime.DaysInMonth(lastWorkingDay.Year, lastWorkingDay.Month), 2)
                : 0m;

        internal static Result Calculate(
            DateOnly hireDate, DateOnly lastWorkingDay, decimal usedDays, decimal unpaidSettledDays, decimal baseSalary)
        {
            var earned = EarnedDaysThisYear(hireDate, lastWorkingDay);
            var unused = Math.Max(0m, earned - usedDays);
            var deficit = Math.Max(0m, usedDays - earned) + Math.Max(0m, unpaidSettledDays);
            var rate = DailyRate(baseSalary, lastWorkingDay);

            return new Result(
                earned,
                unused,
                deficit,
                rate,
                Math.Round(unused * rate, 2),
                Math.Round(deficit * rate, 2));
        }
    }
}
