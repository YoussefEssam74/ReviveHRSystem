namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>
/// Submits an evaluation for an employee (mock 14.6 New Evaluation). One answer per
/// question of the form; scores are numeric ratings (1-5) and comments are optional.
/// </summary>
public sealed class CreateEvaluationResponseDto
{
    /// <summary>Form being answered (must be active and in scope).</summary>
    public int EvaluationFormId { get; init; }

    public IReadOnlyList<EvaluationAnswerDto> Answers { get; init; } = Array.Empty<EvaluationAnswerDto>();

    public string? OverallComment { get; init; }
}

/// <summary>
/// One answer: the question it responds to, its rating, the option values selected
/// for MultipleChoice/Checkbox questions, and an optional comment.
/// </summary>
public sealed class EvaluationAnswerDto
{
    public int QuestionId { get; init; }
    public decimal Score { get; init; }
    public IReadOnlyList<string>? SelectedValues { get; init; }
    public string? Comment { get; init; }
}

/// <summary>Edits an existing evaluation (mock 14.7).</summary>
public sealed class UpdateEvaluationDto
{
    public IReadOnlyList<EvaluationAnswerDto> Answers { get; init; } = Array.Empty<EvaluationAnswerDto>();
    public string? OverallComment { get; init; }
}
