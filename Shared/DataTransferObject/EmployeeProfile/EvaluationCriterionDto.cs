namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class EvaluationCriterionDto
{
    public string Name { get; init; } = string.Empty;
    public decimal Score { get; init; }
    public string? Comment { get; init; }
}
