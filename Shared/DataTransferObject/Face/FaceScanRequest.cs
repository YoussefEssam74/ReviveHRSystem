using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Face;

/// <summary>Face scan request from an attendance station (station-session authenticated).</summary>
public sealed class FaceScanRequest
{
    /// <summary>
    /// IN/OUT (CHECKIN/CHECKOUT aliases are accepted). AUTO lets the server pick the
    /// direction from the employee's current state — what the always-on kiosk camera
    /// sends, since it watches whoever steps in front of it.
    /// </summary>
    [Required, StringLength(10)]
    public string Type { get; init; } = string.Empty;

    /// <summary>Captured camera frame as a base64 data URL (image/jpeg or image/png).</summary>
    [Required, StringLength(4_000_000, MinimumLength = 16)]
    public string Image { get; init; } = string.Empty;

    /// <summary>Frame time as ISO 8601. An omitted offset is interpreted as UTC.</summary>
    public DateTime? Timestamp { get; init; }

    /// <summary>
    /// True only when the employee confirmed "check out now" on the kiosk. An AUTO
    /// scan that would close today's open record returns a pending response (nothing
    /// recorded) unless this flag is set, so a face scan never checks anyone out
    /// silently.
    /// </summary>
    public bool ConfirmCheckout { get; init; }

    /// <summary>
    /// Employee number shown in the "check out now?" prompt, sent back with the
    /// confirmation so the retried scan can be a fresh frame without risking a punch on
    /// whoever else happens to be in front of the camera.
    /// </summary>
    [StringLength(32)]
    public string? ConfirmEmployeeId { get; init; }
}
