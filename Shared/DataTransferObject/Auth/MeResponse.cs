namespace Shared.DataTransferObject.Auth;

/// <summary>
/// Session context for the authenticated user: identity, the active gym, every
/// accessible gym, and the role held IN the active gym. Drives SPA navigation;
/// returned by GET /api/me and by gym switching.
/// </summary>
public sealed class MeResponse
{
    public int UserId { get; init; }
    public string Email { get; init; } = string.Empty;
    public string UserName { get; init; } = string.Empty;
    public string UserType { get; init; } = string.Empty;

    /// <summary>The gym the session is scoped to; null for HR/TopManagement sessions without one.</summary>
    public GymOption? ActiveGym { get; init; }

    /// <summary>Every gym the user can access (gym switcher options).</summary>
    public GymOption[] Gyms { get; init; } = Array.Empty<GymOption>();

    /// <summary>Name of the role the user holds in the active gym, if any.</summary>
    public string? RoleInActiveGym { get; init; }

    /// <summary>Team led by the user in the active gym, when the role is Team Leader.</summary>
    public int? LedTeamId { get; init; }

    /// <summary>
    /// Effective access level per feature in the active gym: <c>0</c> none,
    /// <c>1</c> view, <c>2</c> edit. Derived from the gym's permission keys
    /// (<c>payroll.view</c> → 1, <c>payroll.edit</c>/<c>.approve</c> → 2). Empty when
    /// the session has no gym scope. The SPA gates navigation and actions on it.
    /// </summary>
    public Dictionary<string, int> FeatureLevels { get; init; } = new();

    /// <summary>
    /// The employee profile linked 1:1 to this account (User ↔ Employee), when one
    /// exists. Every self-service route (/api/employees/{id}/schedule, /requests, …)
    /// is addressed by this id — the SPA could not reach them without it.
    /// </summary>
    public int? EmployeeId { get; init; }
}
