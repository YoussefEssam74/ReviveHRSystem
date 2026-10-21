using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Change Position action (POST /api/employees/{id}/position-change): assigns the
    /// employee a (possibly new) position in their gym's catalog at the given level.
    /// </summary>
    public class PositionChangeRequest
    {
        /// <summary>Position title; null keeps the employee's current title.</summary>
        [StringLength(150)]
        public string? Position { get; init; }

        [Required, StringLength(50)]
        public string Level { get; init; } = string.Empty;
    }
}
