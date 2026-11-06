namespace Shared.DataTransferObject.EmployeeProfile;

public sealed class DashboardUserDto
{
    public string FirstName { get; init; } = string.Empty;
    public string Position { get; init; } = string.Empty;
    public string GymName { get; init; } = string.Empty;
    /// <summary>
    /// The gym the employment record is homed in — NOT necessarily the caller's
    /// active gym (a manager may hold no employee record in the gym they lead).
    /// The client uses it to flag that mismatch instead of implying the active
    /// gym is the record's gym.
    /// </summary>
    public int GymId { get; init; }
}
