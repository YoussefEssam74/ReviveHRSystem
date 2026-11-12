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
    /// The employee profile linked 1:1 to this account (User ↔ Employee), when one
    /// exists. Every self-service route (/api/employees/{id}/schedule, /requests, …)
    /// is addressed by this id — the SPA could not reach them without it.
    /// </summary>
    public int? EmployeeId { get; init; }

    /// <summary>
    /// Effective feature access for the active gym: feature code → level
    /// (0 = None, 1 = View, 2 = Edit — ADR-003 Amendment 1). Resolved from the
    /// caller's permission keys, so it matches what the API will actually allow;
    /// Top Management reports Edit everywhere because it bypasses the checks.
    /// The SPA gates console navigation and write controls on this map.
    /// </summary>
    public IReadOnlyDictionary<string, int> FeatureLevels { get; init; } =
        new Dictionary<string, int>();
}
