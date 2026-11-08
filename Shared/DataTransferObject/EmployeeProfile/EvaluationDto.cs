namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>One evaluation with its criteria (mock §9 My Evaluations).</summary>
public sealed class EvaluationDto
{
    public int Id { get; init; }
    public int EmployeeId { get; init; }
    public string EmployeeName { get; init; } = string.Empty;
    public string Period { get; init; } = string.Empty;
    public decimal Score { get; init; }
    public decimal MaxScore { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateOnly Date { get; init; }
    public string Reviewer { get; init; } = string.Empty;
    public IReadOnlyList<EvaluationCriterionDto> Criteria { get; init; } = Array.Empty<EvaluationCriterionDto>();
    public string? OverallComment { get; init; }
}
