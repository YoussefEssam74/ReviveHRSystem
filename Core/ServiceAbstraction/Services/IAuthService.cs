using Shared.DataTransferObject.Auth;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Web application authentication: email + password login issuing an access token
    /// (access-token-only — no refresh tokens, per current database model), including the
    /// login-time gym selection flow for employees assigned to two gyms (ADR-002).
    /// </summary>
    public interface IAuthService
    {
        /// <summary>Validates credentials and either issues tokens or requests gym selection.</summary>
        Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);

        /// <summary>Completes a two-gym employee login by exchanging the temp session token for a gym-scoped access token.</summary>
        Task<LoginResponse> SelectGymAsync(SelectGymRequest request, CancellationToken cancellationToken = default);

        /// <summary>Exchanges a valid refresh token for a new access token + rotated refresh token.</summary>
        Task<LoginResponse> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default);

        /// <summary>
        /// Records the caller's logout and revokes the supplied refresh token (if any).
        /// </summary>
        Task LogoutAsync(int userId, string? refreshToken = null, CancellationToken cancellationToken = default);

        /// <summary>Loads the signed-in user's portal profile: name, position, gyms, permissions (GET /api/auth/me).</summary>
        /// <param name="actorUserId">The authenticated user's id (uid claim).</param>
        /// <param name="selectedGymId">The token's gymId claim, when the session is gym-scoped; otherwise null.</param>
        Task<CurrentUserResponse> GetCurrentUserAsync(int? actorUserId, int? selectedGymId, CancellationToken cancellationToken = default);
    }
}
