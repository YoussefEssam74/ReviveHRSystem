namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Assignment upserts: one entry per employee+date (mock paint grid).</summary>
public sealed class UpdateAssignmentsDto
{
    public IReadOnlyList<ShiftAssignmentEntryDto> Assignments { get; init; } = Array.Empty<ShiftAssignmentEntryDto>();
}
