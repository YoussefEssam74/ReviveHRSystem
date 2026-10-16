using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Kiosk;

/// <summary>Validates an attendance station's six-digit gym code.</summary>
public sealed class StationLoginRequest
{
    [Required, RegularExpression(@"^\d{6}$", ErrorMessage = "Station code must be exactly 6 digits.")]
    public string Code { get; init; } = string.Empty;
}
