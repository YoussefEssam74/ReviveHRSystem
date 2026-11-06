namespace Shared.DataTransferObject.Auth;

/// <summary>Request body for POST /api/auth/refresh.</summary>
public sealed class RefreshRequest
{
    public string? RefreshToken { get; init; }
}