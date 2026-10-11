namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>One employee request (mock §10).</summary>
public sealed class EmployeeRequestDto
{
    public int Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public DateOnly SubmittedDate { get; init; }
    public DateOnly RequestDate { get; init; }
    public DateOnly? EndDate { get; init; }
    public TimeOnly? RequestTime { get; init; }
    public string Status { get; init; } = string.Empty;
    public string Reason { get; init; } = string.Empty;
    public IReadOnlyList<RequestTimelineStepDto> Timeline { get; init; } = Array.Empty<RequestTimelineStepDto>();
}
