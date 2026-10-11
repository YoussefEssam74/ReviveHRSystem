namespace Shared.DataTransferObject.Auth;

/// <summary>
/// Result of an in-session gym switch (ADR-002 Amendment 1): a fresh access token
/// scoped to the new gym plus the refreshed session context (feature levels are
/// per gym, so the SPA must re-gate its navigation on every switch).
/// </summary>
public sealed class SwitchGymResponse
{
    public string AccessToken { get; init; } = string.Empty;
    public int ExpiresInSeconds { get; init; }
    public MeResponse Me { get; init; } = null!;
}
