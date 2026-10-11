namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Edit employee (mock saveEmployee).</summary>
public sealed class UpdateEmployeeDto
{
    public string FullName { get; init; } = string.Empty;
    public int PositionId { get; init; }
    public string Status { get; init; } = string.Empty;
}
