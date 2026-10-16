namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>An employee-facing event or announcement (mock §4 Events).</summary>
public sealed class EmployeeEventDto
{
    public int Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Category { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Detail { get; init; } = string.Empty;
    public DateOnly Date { get; init; }
    public bool Urgent { get; init; }
}
