namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>
/// POST /api/teams — creates a team in the active gym. The leader is the user the
/// HR console just created (resolved to their employee record in that gym), and
/// the members are the employees picked in the Team Leader wizard.
/// </summary>
public sealed class CreateTeamRequest
{
    public string? Name { get; set; }

    /// <summary>User id of the leader (their employee row in the gym is linked).</summary>
    public int? LeaderUserId { get; set; }

    /// <summary>Employee id of the leader — used by the hire wizard, which has no user id yet.</summary>
    public int? LeaderEmployeeId { get; set; }

    /// <summary>Employees assigned to the team.</summary>
    public int[] MemberEmployeeIds { get; set; } = [];
}

/// <summary>GET /api/teams — a team in the active gym with its leader.</summary>
public sealed class TeamListItem
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int GymId { get; init; }
    public string Gym { get; init; } = string.Empty;
    public int? LeaderUserId { get; init; }
    public string? LeaderName { get; init; }
    public int MemberCount { get; init; }
}
