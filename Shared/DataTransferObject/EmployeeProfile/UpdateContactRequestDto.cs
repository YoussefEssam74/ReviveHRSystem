namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Editable contact fields (mock openEditContact modal).</summary>
public sealed class UpdateContactRequestDto
{
    public string? Phone { get; init; }
    public string? Address { get; init; }
}
