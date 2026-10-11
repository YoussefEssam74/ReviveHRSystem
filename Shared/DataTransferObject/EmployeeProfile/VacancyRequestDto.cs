namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A vacancy request raised by a branch (mock §23 Recruitment).</summary>
public sealed class VacancyRequestDto
{
    public int Id { get; init; }
    public string Position { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateOnly Date { get; init; }
    public string RequestedBy { get; init; } = string.Empty;
    public string Justification { get; init; } = string.Empty;
}
