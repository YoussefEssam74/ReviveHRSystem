namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Session eligibility and revocation for web user accounts. Per-request JWT
    /// validation and every termination path share this service so a terminated
    /// employee loses access immediately — including access tokens that were
    /// issued before the termination.
    /// </summary>
    public interface IUserSessionService
    {
        /// <summary>
        /// True when the account is active and, for employee accounts, the linked
        /// employee is not Terminated. A missing user is not allowed.
        /// </summary>
        Task<bool> IsSessionAllowedAsync(int userId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Cuts every live session for the user: deactivates the account and revokes
        /// all non-revoked refresh tokens. Safe to call repeatedly.
        /// </summary>
        Task TerminateAccessAsync(int userId, CancellationToken cancellationToken = default);

        /// <summary>Revokes every non-revoked refresh token for the user.</summary>
        Task RevokeAllRefreshTokensAsync(int userId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Re-enables a previously terminated account after a rehire or a status
        /// correction. No-op when the account is already active.
        /// </summary>
        Task RestoreAccessAsync(int userId, CancellationToken cancellationToken = default);
    }
}
