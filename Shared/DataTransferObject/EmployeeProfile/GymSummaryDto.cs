namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class GymSummaryDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Branch { get; init; }
}
