namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>One payroll period entry for the employee (mock §8).</summary>
public sealed record PayrollEntryDto
{
    public int Id { get; init; }
    public string Period { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateOnly? PaidDate { get; init; }
    public bool Visible { get; init; }
    public decimal BaseSalary { get; init; }
    public decimal TotalBonuses { get; init; }
    public decimal TotalDeductions { get; init; }
    public decimal NetSalary { get; init; }
    public IReadOnlyList<PayrollLineItemDto> Items { get; init; } = Array.Empty<PayrollLineItemDto>();

    /// <summary>Per-day late/absent rows and branch deductions behind the breakdown (mock §8).</summary>
    public IReadOnlyList<PayrollDeductionDetailDto> DeductionDetails { get; init; } =
        Array.Empty<PayrollDeductionDetailDto>();

    // Attendance & leave stats shown in the expanded breakdown (mock §8).
    public int DaysWorked { get; init; }
    public int WorkingDays { get; init; }
    public int ScheduledWeeklyDays { get; init; }
    public decimal OvertimeHours { get; init; }
    public int PaidLeaveDays { get; init; }
    public int SickLeaveDays { get; init; }
    public int AnnualLeaveDays { get; init; }
    public int AbsentDays { get; init; }
    public int LateCount { get; init; }
    public int EarlyLeaveCount { get; init; }
    public int UnpaidLeaveDays { get; init; }
    public decimal LeaveDeduction { get; init; }
    public decimal SalaryAdvance { get; init; }

    /// <summary>The gym's annual-increase policy percent (mock's "Annual Increase (10%)").</summary>
    public decimal? AnnualIncreasePercent { get; init; }

    /// <summary>This period's raise slice: base salary × the gym's annual-increase percent.</summary>
    public decimal AnnualIncrease { get; init; }

    /// <summary>Overtime pay of the period (base/176×1.5×hours — the payslip's derivation).</summary>
    public decimal OvertimePay { get; init; }
}
