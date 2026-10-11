namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class InitiateOffboardingDto
{
    public int EmployeeId { get; init; }
    public DateOnly LastWorkingDate { get; init; }
    public string Reason { get; init; } = string.Empty;
}
