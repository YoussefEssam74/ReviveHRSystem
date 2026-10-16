namespace Shared.DataTransferObject.Face;

/// <summary>
/// Scan outcomes returned by the face pipeline. Every frame produces one of these
/// as a plain 200 (400 is reserved for a frame that could not even be decoded), so
/// the kiosk can drive its live HUD - liveness percentage, matched name/ID - from a
/// discriminator instead of string-matching error messages.
/// </summary>
public static class FaceScanOutcome
{
    /// <summary>No face in the frame. Nothing else was measured.</summary>
    public const string NoFace = "no_face";

    /// <summary>A face was detected but failed the anti-spoofing gate; LivenessScore carries the measured value.</summary>
    public const string LowLiveness = "low_liveness";

    /// <summary>A live face that did not match any enrolled employee in this gym's scope.</summary>
    public const string Unrecognized = "unrecognized";

    /// <summary>Recognized, but the employee's attendance day is already closed. Silent - no card on the kiosk.</summary>
    public const string AlreadyComplete = "already_complete";

    /// <summary>Recognized but refused by a business rule (day off, wrong branch, ...). Message explains why.</summary>
    public const string Rejected = "rejected";

    /// <summary>A punch was recorded; Attendance carries it.</summary>
    public const string Recorded = "recorded";

    /// <summary>Recognized, AUTO resolved to check-out, and the kiosk must ask the employee first.</summary>
    public const string PendingCheckout = "pending_checkout";
}
