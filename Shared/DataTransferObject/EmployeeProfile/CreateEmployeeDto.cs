namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Create employee (mock openNewEmployee).</summary>
public sealed class CreateEmployeeDto
{
    public string FullName { get; init; } = string.Empty;
    public int PositionId { get; init; }
}
