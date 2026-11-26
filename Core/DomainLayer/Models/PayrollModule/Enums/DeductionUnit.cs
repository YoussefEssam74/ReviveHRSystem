namespace DomainLayer.Models.PayrollModule.Enums
{
    /// <summary>
    /// How a manager sized a deduction: in hours of pay (priced by the hourly rate) or
    /// in salary days (priced by the daily rate). The manager picks the unit and the
    /// value; the money follows from the rates the schedule produces.
    /// </summary>
    public enum DeductionUnit
    {
        /// <summary>Salary days — priced at the month's daily rate.</summary>
        Days = 0,

        /// <summary>Hours of pay — priced at the month's hourly rate.</summary>
        Hours = 1,
    }
}
