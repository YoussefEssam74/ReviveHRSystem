using System.Text.Json.Serialization;

namespace Shared.DataTransferObject.Kiosk;

/// <summary>Gym context and session expiry issued when a 6-digit enrollment code is redeemed.</summary>
public sealed class StationLoginResponse
{
    public int GymId { get; init; }
    public string GymName { get; init; } = string.Empty;

    /// <summary>
    /// Opaque station session token for non-browser clients. Browser responses omit it
    /// and rely on the HttpOnly cookie; only its hash is stored server-side.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Token { get; init; }

    /// <summary>When this session stops being accepted (UTC).</summary>
    public DateTime SessionExpiresAtUtc { get; init; }
}
