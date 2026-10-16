using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Status-change modal (POST /api/employees/{id}/status-change): new standing plus
    /// an optional note; both the status and the note land in the employment history.
    /// </summary>
    public class ChangeEmployeeStatusRequest
    {
        /// <summary>Active | On Leave | Suspended | Terminated.</summary>
        [Required, StringLength(30)]
        public string Status { get; init; } = string.Empty;

        [StringLength(500)]
        public string? Note { get; init; }
    }
}
