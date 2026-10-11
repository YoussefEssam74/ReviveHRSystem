namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class LeaveBalanceOverviewDto
{
    public int Year { get; init; }
    public IReadOnlyDictionary<string, LeaveBalanceDto> Balances { get; init; } = new Dictionary<string, LeaveBalanceDto>();
}
