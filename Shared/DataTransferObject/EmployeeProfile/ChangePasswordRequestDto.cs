namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Change-password fields (mock openChangePassword).</summary>
public sealed class ChangePasswordRequestDto
{
    public string CurrentPassword { get; init; } = string.Empty;
    public string NewPassword { get; init; } = string.Empty;
}
