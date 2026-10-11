namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A configurable request type offered by the form (mock requestTypes).</summary>
public sealed class RequestTypeDto
{
    public string Id { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public IReadOnlyList<string> Fields { get; init; } = Array.Empty<string>();
}
