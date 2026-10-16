using Shared.DataTransferObject.Auth;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Session context for the authenticated user (ADR-002 Amendment 1, ADR-003
    /// Amendment 1): identity, gym context, per-gym role and effective feature
    /// levels; plus the in-session gym switch that re-scopes the access token.
    /// </summary>
    public interface ISessionContextService
    {
        /// <summary>
        /// Builds the /api/me payload for the caller. <paramref name="activeGymId"/>
        /// comes from the token's gymId claim (null for sessions without a gym).
        /// </summary>
        Task<MeResponse> GetMeAsync(int userId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Switches the session to another gym in the caller's UserGymAccess and
        /// returns a token scoped to it plus the refreshed context.
        /// </summary>
        Task<SwitchGymResponse> SwitchGymAsync(
            int userId, int gymId, CancellationToken cancellationToken = default);
    }
}
