using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.RequestModule
{
    /// <summary>
    /// Records an approval action taken on an EmployeeRequest at either the BranchManager or HR stage.
    /// Preserves decision outcome, comments, deciding user, and timestamp.
    /// </summary>
    public class RequestDecision : BaseEntity<int>
    {
        public int RequestId { get; set; }
        public virtual EmployeeRequest Request { get; set; } = null!;

        public ApprovalStage Stage { get; set; }
        public DecisionOutcome Decision { get; set; }
        public string? Comment { get; set; }

        public int DecidedBy { get; set; }
        public virtual User DecidedByUser { get; set; } = null!;

        public DateTime DecidedAt { get; set; } = DateTime.UtcNow;
    }
}

