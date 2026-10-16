namespace Shared.DataTransferObject.Auth;

/// <summary>A gym available to the authenticated user.</summary>
public sealed class GymOption
{
    public int GymId { get; init; }
    public string GymName { get; init; } = string.Empty;
}
