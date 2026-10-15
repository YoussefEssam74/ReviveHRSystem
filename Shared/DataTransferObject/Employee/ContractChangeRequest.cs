using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Contract action (POST /api/employees/{id}/contract): re-anchors the contract —
    /// optionally a new level, a new salary (compensation record), and/or a new
    /// contract start date. At least one of the three must be supplied.
    /// </summary>
    public class ContractChangeRequest
    {
        [StringLength(50)]
        public string? Level { get; init; }

        [Range(typeof(decimal), "0.01", "100000000")]
        public decimal? Salary { get; init; }

        public DateOnly? EffectiveDate { get; init; }
    }
}
