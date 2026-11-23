using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Kiosk;

/// <summary>Validates an attendance station's six-digit gym code and the device's own details.</summary>
public sealed class StationLoginRequest
{
    [Required, RegularExpression(@"^\d{6}$", ErrorMessage = "Station code must be exactly 6 digits.")]
    public string Code { get; init; } = string.Empty;

    /// <summary>Browser geolocation latitude; omitted when the station refused the prompt.</summary>
    [Range(-90, 90)]
    public double? Latitude { get; init; }

    [Range(-180, 180)]
    public double? Longitude { get; init; }

    /// <summary>How precise the reported position is, in metres.</summary>
    [Range(0, 100_000)]
    public double? AccuracyMeters { get; init; }
}
