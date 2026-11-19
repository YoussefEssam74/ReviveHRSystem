namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Resolves the management data scope for a user in the active gym
    /// (ADR-003 Amendment 1). Scope comes from the per-gym role: a Branch
    /// Manager bundle ⇒ gym scope, a Team Leader bundle ⇒ team scope (the
    /// leader's TeamLeaders row in that gym), no role ⇒ own data only.
    /// </summary>
    public interface ITeamScopeService
    {
        /// <summary>
        /// The first team the user leads in the gym, or null when the user leads no
        /// team there. Display only — never use it for authorization checks.
        /// </summary>
        Task<int?> GetLedTeamIdAsync(int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>Every team the user leads in the gym (empty when none).</summary>
        Task<IReadOnlyList<int>> GetLedTeamIdsAsync(int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>
        /// True when the user's scope in this gym is team-limited: he holds the Team
        /// Leader role there and holds no gym-wide role (Super Admin / HR / HR Manager /
        /// Branch Manager). Deliberately independent of whether a TeamLeaders row
        /// exists — an unassigned Team Leader is team-scoped with no team, not gym-wide.
        /// </summary>
        Task<bool> IsTeamScopedAsync(int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>True when the user leads the given team in the given gym.</summary>
        Task<bool> LeadsTeamAsync(int userId, int gymId, int teamId, CancellationToken cancellationToken = default);
    }
}
