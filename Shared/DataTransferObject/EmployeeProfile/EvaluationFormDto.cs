namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>An evaluation form available to fill in (mock 14.6).</summary>
public sealed class EvaluationFormDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public IReadOnlyList<EvaluationQuestionDto> Questions { get; init; } = Array.Empty<EvaluationQuestionDto>();
}
