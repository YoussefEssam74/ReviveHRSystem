namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Reschedules an in-flight leaving process (BM moves the last working day).</summary>
public sealed class UpdateOffboardingLastDayDto
{
    public DateOnly LastWorkingDate { get; init; }
}
