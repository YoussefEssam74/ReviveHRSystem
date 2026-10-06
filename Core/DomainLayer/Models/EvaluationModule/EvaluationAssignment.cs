using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EvaluationModule
{
    /// <summary>A form assignment sent to an evaluator for one employee.</summary>
    public class EvaluationAssignment : BaseEntity<int>
    {
        public int EvaluationFormId { get; set; }
        public virtual EvaluationForm EvaluationForm { get; set; } = null!;
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;
        public int EvaluatorUserId { get; set; }
        public virtual User Evaluator { get; set; } = null!;
        public int AssignedBy { get; set; }
        public virtual User AssignedByUser { get; set; } = null!;
        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
        public DateTime? DueAt { get; set; }
        public string Status { get; set; } = "Assigned";
        public int? EvaluationResponseId { get; set; }
        public virtual EvaluationResponse? EvaluationResponse { get; set; }
    }
}

