namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Editable emergency-contact fields.</summary>
public sealed class UpdateEmergencyContactRequestDto
{
    public string? Name { get; init; }
    public string? Relationship { get; init; }
    public string? Phone { get; init; }
}
