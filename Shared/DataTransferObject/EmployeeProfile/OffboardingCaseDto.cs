namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>An offboarding/employee-leaving case (mock §24 Employee Leaving).</summary>
public sealed class OffboardingCaseDto
{
    public int Id { get; init; }
    public int EmployeeId { get; init; }
    public string Employee { get; init; } = string.Empty;
    public string Position { get; init; } = string.Empty;
    public DateOnly LastWorkingDate { get; init; }
    public string Status { get; init; } = string.Empty;
    public string Reason { get; init; } = string.Empty;
}
