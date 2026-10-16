using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Manage Compensation action (POST /api/employees/{id}/compensation): records a
    /// new compensation amount with an effective date; the latest amount becomes the
    /// salary shown across the portal.
    /// </summary>
    public class CompensationRequest
    {
        [Range(typeof(decimal), "0.01", "100000000")]
        public decimal Salary { get; init; }

        public DateOnly EffectiveDate { get; init; }
    }
}
