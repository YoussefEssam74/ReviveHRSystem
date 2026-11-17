namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// One leave category's balance (GET /api/employees/{id}/leave-balance): days
    /// used and the annual entitlement, as the Leave Balance tab renders them.
    /// </summary>
    public class LeaveBalanceBucket
    {
        public decimal Used { get; init; }
        public decimal Total { get; init; }
    }

    /// <summary>
    /// The employee's leave balances for the current year. DayOff maps to the Annual
    /// leave type; sick and unpaid follow the portal's naming.
    /// </summary>
    public class LeaveBalanceResponse
    {
        public int EmployeeId { get; init; }
        public required LeaveBalanceBucket DayOff { get; init; }
        public required LeaveBalanceBucket Sick { get; init; }
        public required LeaveBalanceBucket Unpaid { get; init; }
    }
}
