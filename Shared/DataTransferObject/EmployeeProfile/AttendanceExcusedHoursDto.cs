namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>
/// Monthly excused-hours budget of one employee for late attendance / early leave
/// (mock §6 attendance card). The cap is HR-set per gym and static for all employees;
/// both request types share one budget.
/// </summary>
public sealed class ExcusedHoursBudgetDto
{
    /// <summary>Cap the gym's HR set for every employee, in hours per calendar month.</summary>
    public decimal CapHours { get; init; }

    /// <summary>Hours already spent this calendar month (pending + approved requests).</summary>
    public decimal UsedHours { get; init; }

    /// <summary>Hours still available this month, never negative.</summary>
    public decimal RemainingHours { get; init; }

    /// <summary>The month these numbers describe (yyyy-MM).</summary>
    public string Month { get; init; } = string.Empty;
}

/// <summary>HR-editable attendance policy of a gym (mock §22 attendance settings).</summary>
public sealed class AttendancePolicyDto
{
    public int GymId { get; init; }
    public string GymName { get; init; } = string.Empty;

    /// <summary>Monthly cap of excused late attendance / early leave hours per employee.</summary>
    public decimal ExcusedLateHoursCapPerMonth { get; init; }
}

/// <summary>Body of the attendance-policy update.</summary>
public sealed class UpdateAttendancePolicyDto
{
    public decimal ExcusedLateHoursCapPerMonth { get; init; }
}
