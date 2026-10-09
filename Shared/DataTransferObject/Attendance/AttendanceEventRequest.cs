using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Attendance;

/// <summary>Biometric check-in/out event from an attendance station.</summary>
public sealed class AttendanceEventRequest
{
    [Required, RegularExpression(@"^\d{6}$", ErrorMessage = "Station code must be exactly 6 digits.")]
    public string Code { get; init; } = string.Empty;

    /// <summary>Employee number (for example, EMP-1042) or numeric employee ID.</summary>
    [Required, StringLength(50, MinimumLength = 1)]
    public string EmployeeId { get; init; } = string.Empty;

    /// <summary>IN/OUT (CHECKIN/CHECKOUT aliases are accepted).</summary>
    [Required, StringLength(10)]
    public string Type { get; init; } = string.Empty;

    /// <summary>Face liveness score from 0 through 1; biometric events require at least 0.70.</summary>
    [Range(0d, 1d)]
    public double? LivenessScore { get; init; }

    /// <summary>Event time as ISO 8601. An omitted offset is interpreted as UTC.</summary>
    public DateTime? Timestamp { get; init; }
}
