namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Create-cycle body (mock openCreateScheduleModal).</summary>
public sealed class CreateShiftCycleDto
{
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
}
