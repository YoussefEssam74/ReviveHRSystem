namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class AttendancePersonDto
{
    public int EmployeeId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Position { get; init; } = string.Empty;
    public TimeOnly? CheckIn { get; init; }
    public int? LateMinutes { get; init; }

    /// <summary>Day the row belongs to; set for roster rows, null for exception lists.</summary>
    public DateOnly? Date { get; init; }

    /// <summary>Attendance status name (On Time | Late | Absent | Early Checkout | Missing Checkout).</summary>
    public string? Status { get; init; }
}
