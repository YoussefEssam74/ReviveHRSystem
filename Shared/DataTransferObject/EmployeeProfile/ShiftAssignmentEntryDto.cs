namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class ShiftAssignmentEntryDto
{
    public int EmployeeId { get; init; }
    public DateOnly Date { get; init; }
    public int? ShiftTemplateId { get; init; }
}
