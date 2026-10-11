namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Leave balances per type (mock leaveBalance), keyed by leave type name.</summary>
public sealed class LeaveBalanceDto
{
    public decimal Total { get; init; }
    public decimal Used { get; init; }
    public decimal Pending { get; init; }
    public decimal Remaining { get; init; }
}
