using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Edit-modal fields (PUT /api/employees/{id}): all optional; supplied fields are
    /// applied and position/status changes are written to the employment history.
    /// </summary>
    public class UpdateEmployeeRequest
    {
        [StringLength(200)]
        public string? Name { get; init; }

        /// <summary>Position title; matched in the employee's gym catalog or created.</summary>
        [StringLength(150)]
        public string? Position { get; init; }

        /// <summary>Active | On Leave | Suspended | Terminated.</summary>
        [StringLength(30)]
        public string? Status { get; init; }
    }
}
