using System.Text.Json.Serialization;

namespace Shared.DataTransferObject.Auth;

/// <summary>
/// Result of an in-session gym switch (ADR-002 Amendment 1): a fresh access token
/// scoped to the new gym plus the refreshed session context (feature levels are
/// per gym, so the SPA must re-gate its navigation on every switch).
/// </summary>
/// <remarks>
/// The switch also rotates the refresh credential: the returned refresh token is
/// scoped to the TARGET gym so every later silent refresh keeps that scope — the
/// original login's chain would otherwise pull the session back to the gym it
/// started in (the refresh endpoint transparently preserves its token's scope).
/// </remarks>
public sealed class SwitchGymResponse
{
    public string AccessToken { get; init; } = string.Empty;
    public int ExpiresInSeconds { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? RefreshToken { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? RefreshExpiresInSeconds { get; init; }

    public MeResponse Me { get; init; } = null!;
}
