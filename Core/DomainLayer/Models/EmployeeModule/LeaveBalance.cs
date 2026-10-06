using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>
    /// Tracks annual leave entitlements and balances per employee per leave category (Annual, Sick, Emergency, Unpaid).
    /// Tracks total days granted, days consumed by approved requests, and days locked by in-flight pending requests.
    /// </summary>
    public class LeaveBalance : BaseEntity
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public LeaveType LeaveType { get; set; }
        public int Year { get; set; }
        public decimal TotalEntitlement { get; set; }
        public decimal UsedDays { get; set; } = 0;
        public decimal PendingDays { get; set; } = 0;

        public decimal RemainingDays => TotalEntitlement - UsedDays - PendingDays;

        public int? UpdatedBy { get; set; }
        public virtual User? UpdatedByUser { get; set; }
    }
}
