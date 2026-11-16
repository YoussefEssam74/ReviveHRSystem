namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Leave and attendance numbers the Create Account form starts from: the annual
    /// days earned by the hire date, the standard sick-leave allowance, and the
    /// branch's monthly excused-hours cap. Every value stays editable before the
    /// account is created; the edited numbers are sent back on POST /api/employees.
    /// </summary>
    public class LeaveDefaultsResponse
    {
        /// <summary>Annual days earned on the hire date (0 for a fresh hire).</summary>
        public decimal AnnualLeaveDays { get; init; }

        /// <summary>Yearly ceiling a grant can raise the annual allowance to.</summary>
        public decimal AnnualLeaveMaxDays { get; init; }

        /// <summary>Standard sick-leave allowance in days.</summary>
        public decimal SickLeaveDays { get; init; }

        /// <summary>Branch attendance policy: excused late/early hours per month.</summary>
        public decimal ExcusedHoursPerMonth { get; init; }
    }
}
