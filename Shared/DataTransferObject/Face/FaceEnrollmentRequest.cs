using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Face;

/// <summary>Enrolls (or re-enrolls) an employee's face from one camera frame.</summary>
public sealed class FaceEnrollmentRequest
{
    /// <summary>Employee number (for example EMP-1042) or numeric employee ID.</summary>
    [Required, StringLength(50, MinimumLength = 1)]
    public string EmployeeNumber { get; init; } = string.Empty;

    /// <summary>Captured camera frame as a base64 data URL (image/jpeg or image/png).</summary>
    [Required, StringLength(4_000_000, MinimumLength = 16)]
    public string Image { get; init; } = string.Empty;
}

/// <summary>Confirmation of a stored face enrollment.</summary>
public sealed class FaceEnrollmentResponse
{
    public int EmployeeId { get; init; }
    public string EmployeeNumber { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public DateTime EnrolledAt { get; init; }
}
