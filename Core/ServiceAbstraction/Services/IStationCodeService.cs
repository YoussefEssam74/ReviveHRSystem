using Shared.DataTransferObject.Gym;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// HR-side management of a gym's station credentials: the short-lived 6-digit
    /// enrollment code kiosks redeem, and the station sessions those redemptions
    /// create. Access is limited to TopManagement or HR users assigned to the gym.
    /// </summary>
    public interface IStationCodeService
    {
        /// <summary>Rotates the gym's enrollment code, immediately invalidating the previous one.</summary>
        Task<StationCodeResponse> RotateAsync(int gymId, int? actorUserId, CancellationToken cancellationToken = default);

        /// <summary>Returns the gym's current active enrollment code.</summary>
        Task<StationCodeResponse> GetCurrentAsync(int gymId, int actorUserId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Revokes every live station session for the gym so enrolled kiosks must
        /// re-enroll with a fresh code. Rotating the code does not revoke sessions.
        /// Returns how many sessions were revoked.
        /// </summary>
        Task<int> RevokeStationSessionsAsync(int gymId, int? actorUserId, CancellationToken cancellationToken = default);
    }
}
