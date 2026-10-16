using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.PayrollModule
{
    /// <summary>
    /// A bonus proposed by a Branch Manager for HR approval; an approved proposal
    /// becomes a payroll line item for the employee. The proposal itself never
    /// touches payroll until HR approves it.
    /// </summary>
    public class BonusProposal : BaseEntity<int>
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        /// <summary>Category: Performance Bonus, Overtime Pay, Attendance Reward, Referral Bonus, Other.</summary>
        public string Type { get; set; } = string.Empty;

        public decimal Amount { get; set; }

        public string Reason { get; set; } = string.Empty;

        /// <summary>Supporting numbers for HR (revenue, coverage, KPIs).</summary>
        public string? Note { get; set; }

        public int IssuedBy { get; set; }
        public virtual User IssuedByUser { get; set; } = null!;

        public DateTime IssuedAt { get; set; } = DateTime.UtcNow;

        public ProposalStatus Status { get; set; } = ProposalStatus.Pending;
    }
}
