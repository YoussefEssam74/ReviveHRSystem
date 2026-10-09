using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Face;

/// <summary>Face scan request from an attendance station (public, station-code authenticated).</summary>
public sealed class FaceScanRequest
{
    [Required, RegularExpression(@"^\d{6}$", ErrorMessage = "Station code must be exactly 6 digits.")]
    public string Code { get; init; } = string.Empty;

    /// <summary>IN/OUT (CHECKIN/CHECKOUT aliases are accepted).</summary>
    [Required, StringLength(10)]
    public string Type { get; init; } = string.Empty;

    /// <summary>Captured camera frame as a base64 data URL (image/jpeg or image/png).</summary>
    [Required, StringLength(4_000_000, MinimumLength = 16)]
    public string Image { get; init; } = string.Empty;

    /// <summary>Frame time as ISO 8601. An omitted offset is interpreted as UTC.</summary>
    public DateTime? Timestamp { get; init; }
}
