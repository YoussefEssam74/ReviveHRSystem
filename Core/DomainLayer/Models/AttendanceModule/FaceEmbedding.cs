using DomainLayer.Models.EmployeeModule;

namespace DomainLayer.Models.AttendanceModule
{
    /// <summary>
    /// Stored face biometric of an employee: the 128-d SFace embedding produced
    /// during enrollment. One row per employee (re-enrolling replaces the feature).
    /// </summary>
    public class FaceEmbedding : BaseEntity<int>
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        /// <summary>SFace 128-d feature vector (L2-normalized on comparison).</summary>
        public float[] Feature { get; set; } = Array.Empty<float>();

        public DateTime EnrolledAt { get; set; }
    }
}
