namespace Shared.DataTransferObject.Kiosk;

/// <summary>Gym context and station token resolved from the 6-digit station code.</summary>
public sealed class StationLoginResponse
{
    public int GymId { get; init; }
    public string GymName { get; init; } = string.Empty;

    /// <summary>Station JWT bound to this gym — send as "Authorization: Bearer" on attendance requests.</summary>
    public string Token { get; init; } = string.Empty;
}
