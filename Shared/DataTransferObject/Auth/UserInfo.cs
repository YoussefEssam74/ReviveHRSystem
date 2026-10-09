namespace Shared.DataTransferObject.Auth;

/// <summary>Safe user summary returned after login.</summary>
public sealed class UserInfo
{
    public int Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string UserName { get; init; } = string.Empty;
    public string UserType { get; init; } = string.Empty;
    public string[] Permissions { get; init; } = Array.Empty<string>();
    public GymOption[] GymAccess { get; init; } = Array.Empty<GymOption>();
    public int? GymId { get; init; }
    public string? GymName { get; init; }
}
