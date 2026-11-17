using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Transfer Gym action (POST /api/employees/{id}/transfer): moves the employee's
    /// home gym, updates their access rows, and records the move in history.
    /// </summary>
    public class TransferEmployeeRequest
    {
        /// <summary>Target gym id.</summary>
        [Range(1, int.MaxValue)]
        public int ToGym { get; init; }

        public DateOnly EffectiveDate { get; init; }

        [Required, StringLength(500)]
        public string Reason { get; init; } = string.Empty;
    }
}
