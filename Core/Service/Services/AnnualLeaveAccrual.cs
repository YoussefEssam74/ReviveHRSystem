namespace Service.Services
{
    /// <summary>
    /// Annual-leave entitlement as a function of completed service, per the product
    /// rule: the employee accrues one day per completed month of service, nothing is
    /// released before the sixth month is complete, and the yearly maximum is the
    /// twelve days that one year of service earns.
    ///
    /// Entitlement is recomputed on every read (never trusted from the stored
    /// <c>LeaveBalance.TotalEntitlement</c>) so a new hire cannot spend days he has
    /// not earned yet, and a tenured employee keeps the full yearly allowance.
    /// </summary>
    internal static class AnnualLeaveAccrual
    {
        /// <summary>Completed months of service required before any annual day is released.</summary>
        internal const int QualifyingMonths = 6;

        /// <summary>Days one full year of service earns — 1 per month, capped here.</summary>
        internal const int MaxDaysPerYear = 12;

        /// <summary>
        /// Whole months of service completed between <paramref name="hireDate"/> and
        /// <paramref name="asOf"/>. An anniversary counts as completed on its own day:
        /// hired 2026-10-04 → 6 months on 2027-04-04.
        /// </summary>
        internal static int CompletedServiceMonths(DateOnly hireDate, DateOnly asOf)
        {
            if (asOf <= hireDate)
            {
                return 0;
            }

            var months = ((asOf.Year - hireDate.Year) * 12) + (asOf.Month - hireDate.Month);
            if (asOf.Day < hireDate.Day)
            {
                months--;
            }

            return Math.Max(0, months);
        }

        /// <summary>
        /// Annual days the employee may hold on <paramref name="asOf"/>: zero until the
        /// qualifying period completes, then one day per completed service month, capped
        /// at <see cref="MaxDaysPerYear"/>.
        /// </summary>
        internal static decimal EntitledDays(DateOnly hireDate, DateOnly asOf)
        {
            var months = CompletedServiceMonths(hireDate, asOf);
            return months < QualifyingMonths
                ? 0m
                : Math.Min(MaxDaysPerYear, months);
        }
    }
}
