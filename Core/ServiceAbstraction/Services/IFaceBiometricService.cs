using Shared.DataTransferObject.Face;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// In-process face biometrics (YuNet detect + Silent-Face anti-spoofing + SFace
    /// recognition, all ONNX inside the API — no external Python service).
    /// </summary>
    public interface IFaceBiometricService
    {
        /// <summary>
        /// Detects a live face in the frame, matches it against enrolled employees with
        /// access to the station's gym, and records the attendance event atomically.
        /// <paramref name="authorizedGymId"/> is the gymId claim of the caller's token —
        /// it must match the gym the station code resolves to.
        /// </summary>
        Task<FaceScanResponse> ScanFaceAsync(FaceScanRequest request, int? authorizedGymId = null, string? ipAddress = null, CancellationToken cancellationToken = default);

        /// <summary>
        /// Enrolls (or replaces) an employee's face embedding from one frame.
        /// <paramref name="actorUserId"/> is the acting user's id from the token's uid
        /// claim — they must be TopManagement, or HR with access to the employee's gym.
        /// </summary>
        Task<FaceEnrollmentResponse> EnrollFaceAsync(FaceEnrollmentRequest request, int? actorUserId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Removes an employee's stored face embedding.
        /// <paramref name="actorUserId"/> is the acting user's id from the token's uid
        /// claim — they must be TopManagement, or HR with access to the employee's gym.
        /// </summary>
        Task RemoveEmployeeFaceAsync(string employeeReference, int? actorUserId, CancellationToken cancellationToken = default);
    }
}
