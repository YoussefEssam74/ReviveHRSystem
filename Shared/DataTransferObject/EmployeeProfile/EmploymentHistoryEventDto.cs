namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class EmploymentHistoryEventDto
{
    public string Type { get; init; } = string.Empty;
    public string? From { get; init; }
    public string? To { get; init; }
    public DateOnly Effective { get; init; }
    public string? Detail { get; init; }
}
