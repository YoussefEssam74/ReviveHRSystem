namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>One payroll period entry for the employee (mock §8).</summary>
public sealed class PayrollEntryDto
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
}
