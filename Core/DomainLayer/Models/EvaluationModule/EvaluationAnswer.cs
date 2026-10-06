namespace DomainLayer.Models.EvaluationModule
{
    /// <summary>
    /// Stores the response to a specific EvaluationQuestion within an EvaluationResponse.
    /// Stores the answer value (numeric rating or chosen options) in a flexible JSONB column.
    /// </summary>
    public class EvaluationAnswer : BaseEntity
    {
        public int EvaluationResponseId { get; set; }
        public virtual EvaluationResponse EvaluationResponse { get; set; } = null!;

        public int EvaluationQuestionId { get; set; }
        public virtual EvaluationQuestion EvaluationQuestion { get; set; } = null!;

        // JSONB string containing rating number or selected option(s)
        public string AnswerValueJson { get; set; } = string.Empty;
    }
}
