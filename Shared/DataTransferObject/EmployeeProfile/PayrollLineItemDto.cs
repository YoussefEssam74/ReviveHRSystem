namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class PayrollLineItemDto
{
    public string Label { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string Kind { get; init; } = string.Empty;
    public DateOnly EffectiveDate { get; init; }
    public string? Reason { get; init; }

    /// <summary>Attendance day this line prices (per-day deductions), when linked.</summary>
    public int? AttendanceRecordId { get; init; }

    /// <summary>Line review state — Pending surfaces as "In review" on the sheet.</summary>
    public string Status { get; init; } = string.Empty;
}
