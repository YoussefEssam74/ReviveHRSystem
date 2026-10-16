namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Employment status change (mock openChangeStatus).</summary>
public sealed class ChangeEmployeeStatusDto
{
    public string Status { get; init; } = string.Empty;
    public string? Note { get; init; }
}
