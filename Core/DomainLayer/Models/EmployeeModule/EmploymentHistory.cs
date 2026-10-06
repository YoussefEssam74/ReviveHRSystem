using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>
    /// Audit timeline tracking lifecycle changes to an employee's career.
    /// Captures transfers between gyms, position updates, raises, contract renewals, status changes, and offboarding with who/when/why.
    /// </summary>
    public class EmploymentHistory : BaseEntity
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public EmploymentChangeType ChangeType { get; set; }
        public string? OldValueJson { get; set; }
        public string? NewValueJson { get; set; }
        public DateOnly EffectiveDate { get; set; }

        public int ChangedBy { get; set; }
        public virtual User ChangedByUser { get; set; } = null!;

        public string? Reason { get; set; }
    }
}
