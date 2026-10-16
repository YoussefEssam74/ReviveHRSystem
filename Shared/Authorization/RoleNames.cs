namespace Shared.Authorization;

/// <summary>
/// Names of the seeded preset roles (ADR-003 Amendment 1). The Team Leader role is the
/// team-scoped one: a user holding it in a gym sees only his team's data. Branch
/// Manager is gym-scoped. Both bundles grant the same feature levels — scope comes
/// from the role, not the bundle.
/// </summary>
public static class RoleNames
{
    public const string Employee = "Employee";
    public const string TeamLeader = "Team Leader";
    public const string BranchManager = "Branch Manager";
    public const string Hr = "HR";
    public const string HrManager = "HR Manager";
    public const string SuperAdmin = "Super Admin";
}
