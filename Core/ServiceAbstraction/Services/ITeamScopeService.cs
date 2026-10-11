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
        /// The team the user leads in the gym, or null when the user has no
        /// team-leader assignment there (gym-wide or own-data scope).
        /// </summary>
        Task<int?> GetLedTeamIdAsync(int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>True when the user's scope in this gym is team-limited.</summary>
        Task<bool> IsTeamScopedAsync(int userId, int gymId, CancellationToken cancellationToken = default);
    }
}
