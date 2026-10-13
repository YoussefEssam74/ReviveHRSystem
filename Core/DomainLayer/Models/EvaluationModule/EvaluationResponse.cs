using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EvaluationModule
{
    /// <summary>
    /// Represents an evaluation instance / review submitted for an Employee.
    /// Captures the evaluating user (manager/team leader), submission timestamp, and links to question answers.
    /// </summary>
    public class EvaluationResponse : BaseEntity<int>
    {
        public int EvaluationFormId { get; set; }
        public virtual EvaluationForm EvaluationForm { get; set; } = null!;

        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public int EvaluatedBy { get; set; }
        public virtual User Evaluator { get; set; } = null!;

        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Evaluator's wrap-up comment (mock 14.6 New Evaluation modal).</summary>
        public string? OverallComment { get; set; }

        public virtual ICollection<EvaluationAnswer> Answers { get; set; } = new List<EvaluationAnswer>();
    }
}

