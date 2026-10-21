using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Onboards a new employee (POST /api/employees): personal identity, the gym and
    /// position to anchor them to (created in the catalog when missing), and the
    /// starting salary. The account is created with the standard temporary password.
    /// </summary>
    public class CreateEmployeeRequest
    {
        [Required, StringLength(100)]
        public string FirstName { get; init; } = string.Empty;

        [Required, StringLength(100)]
        public string LastName { get; init; } = string.Empty;

        [Required, EmailAddress, StringLength(254)]
        public string Email { get; init; } = string.Empty;

        [Phone, StringLength(30)]
        public string? Phone { get; init; }

        /// <summary>Position title; matched in the gym's catalog or created.</summary>
        [Required, StringLength(150)]
        public string Position { get; init; } = string.Empty;

        [Required, StringLength(50)]
        public string Level { get; init; } = string.Empty;

        [Range(typeof(decimal), "0", "100000000")]
        public decimal? Salary { get; init; }

        /// <summary>Home gym id.</summary>
        [Range(1, int.MaxValue)]
        public int Gym { get; init; }

        public DateOnly StartDate { get; init; }
    }
}
