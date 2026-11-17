using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Edit Balance form (PUT /api/employees/{id}/leave-balance): new used/total
    /// values for the annual (day off), sick, and unpaid categories of the current
    /// year. Pending days locked by in-flight requests are preserved server-side.
    /// </summary>
    public class UpdateLeaveBalanceRequest
    {
        [Required]
        public LeaveBalanceBucketInput DayOff { get; init; } = new();

        [Required]
        public LeaveBalanceBucketInput Sick { get; init; } = new();

        [Required]
        public LeaveBalanceBucketInput Unpaid { get; init; } = new();
    }

    public class LeaveBalanceBucketInput
    {
        [Range(typeof(decimal), "0", "365")]
        public decimal Used { get; init; }

        [Range(typeof(decimal), "0", "365")]
        public decimal Total { get; init; }
    }
}
