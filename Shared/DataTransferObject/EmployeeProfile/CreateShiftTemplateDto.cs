namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class CreateShiftTemplateDto
{
    public string Name { get; init; } = string.Empty;
    public TimeOnly Start { get; init; }
    public TimeOnly End { get; init; }

    /// <summary>Optional base #rrggbb color; defaults to the schedule palette blue.</summary>
    public string? Color { get; init; }
}
