namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class UpdateShiftTemplateDto
{
    public string Name { get; init; } = string.Empty;
    public TimeOnly Start { get; init; }
    public TimeOnly End { get; init; }
}
