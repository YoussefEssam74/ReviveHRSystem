namespace Shared.DataTransferObject.Kiosk;

/// <summary>Gym context and station session token issued when a 6-digit enrollment code is redeemed.</summary>
public sealed class StationLoginResponse
{
    public int GymId { get; init; }
    public string GymName { get; init; } = string.Empty;

    /// <summary>
    /// Opaque station session token — shown here exactly once (only its hash is stored
    /// server-side). Send it as the "X-Station-Token" header on attendance requests;
    /// the server derives the GymId from the session, never from the request body.
    /// </summary>
    public string Token { get; init; } = string.Empty;

    /// <summary>When this session stops being accepted (UTC).</summary>
    public DateTime SessionExpiresAtUtc { get; init; }
}
