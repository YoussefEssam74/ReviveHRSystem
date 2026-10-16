using DomainLayer.Models.EvaluationModule.Enums;

namespace DomainLayer.Models.EvaluationModule
{
    /// <summary>
    /// Represents an individual question on an evaluation form.
    /// Supports Rating5, MultipleChoice, or Checkbox formats, storing selectable choices as JSONB in OptionsJson.
    /// </summary>
    public class EvaluationQuestion : BaseEntity<int>
    {
        public int EvaluationFormId { get; set; }
        public virtual EvaluationForm EvaluationForm { get; set; } = null!;

        public string QuestionText { get; set; } = string.Empty;
        public EvaluationQuestionType QuestionType { get; set; }

        // JSONB string for options (used for MultipleChoice and Checkbox)
        public string? OptionsJson { get; set; }

        public int SortOrder { get; set; }
    }
}

