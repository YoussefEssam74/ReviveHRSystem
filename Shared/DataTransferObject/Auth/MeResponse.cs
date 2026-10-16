namespace Shared.DataTransferObject.Auth;

/// <summary>
/// Session context for the authenticated user (ADR-003 Amendment 1): identity,
/// the active gym, every accessible gym, the role held IN the active gym, and the
/// effective feature access levels for the active gym. Drives SPA navigation and
/// action gating; returned by GET /api/me and by gym switching.
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
    /// Effective feature levels for the active gym: feature code (see Shared.Authorization.Features)
    /// mapped to level (0=None, 1=View, 2=Edit). Absent features mean None.
    /// </summary>
    public IReadOnlyDictionary<string, int> FeatureLevels { get; init; } = new Dictionary<string, int>();
}
