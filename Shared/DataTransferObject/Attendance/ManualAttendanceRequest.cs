using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Attendance;

/// <summary>Manual check-in/out fallback from an attendance station.</summary>
public sealed class ManualAttendanceRequest
{
    [Required, RegularExpression(@"^\d{6}$", ErrorMessage = "Station code must be exactly 6 digits.")]
    public string Code { get; init; } = string.Empty;

    [Required, StringLength(50, MinimumLength = 1)]
    public string EmployeeId { get; init; } = string.Empty;

    [Required, StringLength(10)]
    public string Type { get; init; } = string.Empty;

    /// <summary>Event time as ISO 8601. An omitted offset is interpreted as UTC.</summary>
    public DateTime? Timestamp { get; init; }

    /// <summary>Required explanation for the manual entry; stored in the audit log.</summary>
    [Required, StringLength(500, MinimumLength = 3)]
    public string Reason { get; init; } = string.Empty;
}
