namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class CreateVacancyRequestDto
{
    public int PositionId { get; init; }
    public string Justification { get; init; } = string.Empty;
}
