namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A shift cycle with its assignments (mock §15 grid).</summary>
public sealed class ShiftCycleDetailDto
{
    public int Id { get; init; }
    public DateOnly Start { get; init; }
    public DateOnly End { get; init; }
    public string Status { get; init; } = string.Empty;
    public IReadOnlyList<DateOnly> Days { get; init; } = Array.Empty<DateOnly>();
    public IReadOnlyList<ShiftAssignmentRowDto> Assignments { get; init; } = Array.Empty<ShiftAssignmentRowDto>();
}
