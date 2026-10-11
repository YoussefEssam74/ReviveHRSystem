namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Full employee profile (self-service My Profile, mock §2.1).</summary>
public sealed class EmployeeProfileDto
{
    public int Id { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string Position { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string EmploymentType { get; init; } = string.Empty;
    public DateOnly? HireDate { get; init; }
    public DateOnly? DateOfBirth { get; init; }
    public string? NationalId { get; init; }
    public string? Gender { get; init; }
    public string? Address { get; init; }
    public string? Phone { get; init; }
    public string Email { get; init; } = string.Empty;
    public GymSummaryDto Gym { get; init; } = null!;
    public EmergencyContactDto EmergencyContact { get; init; } = null!;

    /// <summary>HR-controlled salary; only populated for the employee's own profile.</summary>
    public decimal? BaseSalary { get; init; }
}
