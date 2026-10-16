namespace Shared.DataTransferObject.Kiosk;

/// <summary>
/// Gym context of a live station session — returned by GET /api/kiosk/session so the
/// kiosk SPA can restore its connected state from the HttpOnly session cookie without
/// ever handling the token itself.
/// </summary>
public sealed class StationSessionResponse
{
    public int GymId { get; init; }
    public string GymName { get; init; } = string.Empty;

    /// <summary>When this session stops being accepted (UTC).</summary>
    public DateTime SessionExpiresAtUtc { get; init; }
}
