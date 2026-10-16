using Shared.DataTransferObject.Attendance;

namespace Shared.DataTransferObject.Face;

/// <summary>
/// Result of one face scan. Every frame yields a 200 with an <see cref="Outcome"/>
/// discriminator - only a frame that could not be decoded as an image is a 400 - so
/// the station can show a live HUD (liveness percentage, matched name and ID) and
/// distinguish a silent "already complete" from a rejection that deserves a card.
/// </summary>
public sealed class FaceScanResponse
{
    /// <summary>One of the <see cref="FaceScanOutcome"/> constants.</summary>
    public string Outcome { get; init; } = FaceScanOutcome.NoFace;

    /// <summary>The recorded punch; set only when <see cref="Outcome"/> is <c>recorded</c>.</summary>
    public AttendanceResponse? Attendance { get; init; }

    /// <summary>
    /// True when the matched employee must confirm the check-out on the kiosk
    /// (<see cref="Outcome"/> is <c>pending_checkout</c>); nothing is recorded yet.
    /// </summary>
    public bool RequiresCheckoutConfirmation { get; init; }

    /// <summary>Employee number of the matched employee, whenever a face was recognized.</summary>
    public string? EmployeeId { get; init; }

    /// <summary>Full name of the matched employee, whenever a face was recognized.</summary>
    public string? EmployeeName { get; init; }

    /// <summary>Human-readable detail for the station HUD (rejection reason, liveness hint, ...).</summary>
    public string? Message { get; init; }

    /// <summary>Cosine similarity of the best match (0..1; match threshold 0.50).</summary>
    public double Similarity { get; init; }

    /// <summary>Anti-spoofing "real face" confidence measured on this frame (0..1).</summary>
    public double LivenessScore { get; init; }
}
