using Shared.DataTransferObject.Gym;

namespace ServiceAbstraction.Services
{
    /// <summary>Gym directory for the HR portal: the gyms a signed-in user may work with.</summary>
    public interface IGymService
    {
        /// <summary>
        /// Lists the visible gyms: every active gym for Top Management, the user's
        /// assigned gyms otherwise. Each item carries the branch location and the
        /// gym's active staff count (GET /api/gyms).
        /// </summary>
        Task<IReadOnlyList<GymListResponse>> GetGymsAsync(int? actorUserId, CancellationToken cancellationToken = default);
    }
}
