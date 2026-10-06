using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>
    /// Represents salary and compensation records for an employee.
    /// Supports historical tracking of compensation adjustments (off-cycle raises, annual automated raises) with effective dates and reasons.
    /// </summary>
    public class Compensation : BaseEntity
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public decimal Amount { get; set; }
        public string Currency { get; set; } = "EGP";
        public DateOnly EffectiveDate { get; set; }

        public int ChangedBy { get; set; }
        public virtual User ChangedByUser { get; set; } = null!;

        public string? Reason { get; set; }
    }
}
