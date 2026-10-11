namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class RequestTimelineStepDto
{
    public string Step { get; init; } = string.Empty;
    public string? Date { get; init; }
    public bool Done { get; init; }
}
