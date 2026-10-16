using DomainLayer.Models.OrganizationModule;

namespace DomainLayer.Models.EvaluationModule
{
    /// <summary>
    /// Represents a dynamic evaluation questionnaire template built by HR.
    /// Can be scoped to a specific Gym, Position, or globally applied. Contains a collection of custom questions.
    /// </summary>
    public class EvaluationForm : BaseEntity<int>
    {
        public int? GymId { get; set; }
        public virtual Gym? Gym { get; set; }

        public int? PositionId { get; set; }
        public virtual Position? Position { get; set; }

        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;

        public virtual ICollection<EvaluationQuestion> Questions { get; set; } = new List<EvaluationQuestion>();
        public virtual ICollection<EvaluationResponse> Responses { get; set; } = new List<EvaluationResponse>();
        public virtual ICollection<EvaluationAssignment> Assignments { get; set; } = new List<EvaluationAssignment>();
    }
}

