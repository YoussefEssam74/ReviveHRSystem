using Shared.DataTransferObject.Attendance;

namespace Shared.DataTransferObject.Face;

/// <summary>A face scan that matched a known employee and recorded the event.</summary>
public sealed class FaceScanResponse
{
    public required AttendanceResponse Attendance { get; init; }

    /// <summary>Cosine similarity of the best match (0..1; match threshold 0.50).</summary>
    public double Similarity { get; init; }

    /// <summary>Anti-spoofing "real face" confidence measured on this frame.</summary>
    public double LivenessScore { get; init; }
}
