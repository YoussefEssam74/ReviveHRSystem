namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>One employee's shift assignments across the cycle's days.</summary>
public sealed class ShiftAssignmentRowDto
{
    public int EmployeeId { get; init; }
    public string Name { get; init; } = string.Empty;
    public IReadOnlyList<int?> ShiftTemplateIds { get; init; } = Array.Empty<int?>();
}
