namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class PayrollLineItemDto
{
    public string Label { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string Kind { get; init; } = string.Empty;
    public DateOnly EffectiveDate { get; init; }
    public string? Reason { get; init; }
}
