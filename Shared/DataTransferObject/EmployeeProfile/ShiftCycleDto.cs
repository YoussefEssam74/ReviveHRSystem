namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A shift cycle (schedule period) of a gym (mock §15).</summary>
public sealed class ShiftCycleDto
{
    public int Id { get; init; }
    public DateOnly Start { get; init; }
    public DateOnly End { get; init; }
    public string Label { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public bool Custom { get; init; }
}
