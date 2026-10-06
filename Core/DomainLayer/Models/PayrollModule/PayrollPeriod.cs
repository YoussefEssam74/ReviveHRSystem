using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.PayrollModule
{
    /// <summary>
    /// Represents a formal salary processing period (e.g., Monthly) scoped to a Gym.
    /// Tracks period date boundaries, approval lifecycle (Open, Approved, Locked), and approving manager.
    /// </summary>
    public class PayrollPeriod : BaseEntity
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public DateOnly StartDate { get; set; }
        public DateOnly EndDate { get; set; }
        public PayrollPeriodStatus Status { get; set; } = PayrollPeriodStatus.Open;

        public int? ApprovedBy { get; set; }
        public virtual User? Approver { get; set; }

        public DateTime? ApprovedAt { get; set; }

        public virtual ICollection<PayrollEntry> Entries { get; set; } = new List<PayrollEntry>();
    }
}
