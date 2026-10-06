namespace DomainLayer.Models.EvaluationModule.Enums
{
    /// <summary>
    /// Identifies the format of an evaluation form question.
    /// Rating5 (1 to 5 star/number rating), MultipleChoice (single selection from list), Checkbox (multiple options selectable).
    /// </summary>
    public enum EvaluationQuestionType
    {
        Rating5 = 1,
        MultipleChoice = 2,
        Checkbox = 3
    }
}
