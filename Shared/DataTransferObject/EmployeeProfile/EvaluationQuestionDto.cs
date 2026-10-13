namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>One question of an evaluation form.</summary>
public sealed class EvaluationQuestionDto
{
    public int Id { get; init; }
    public string Text { get; init; } = string.Empty;

    /// <summary>Rating5, MultipleChoice or Checkbox.</summary>
    public string Type { get; init; } = string.Empty;
}
