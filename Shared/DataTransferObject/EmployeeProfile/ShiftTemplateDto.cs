namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A reusable shift template of a gym (mock §16). Off days are assignments
/// without a template, so templates always carry real times.</summary>
public sealed class ShiftTemplateDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public TimeOnly Start { get; init; }
    public TimeOnly End { get; init; }

    /// <summary>Base #rrggbb color chosen by the manager.</summary>
    public string Color { get; init; } = "#0ea5e9";
}
