using Shared.DataTransferObject;
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

        /// <summary>
        /// Stores a replacement branch logo and points the gym row at it, then removes
        /// the superseded file. Branch branding is provisioned centrally, so this
        /// requires the platform branch-management permission
        /// (PUT /api/gyms/{gymId}/logo).
        /// </summary>
        /// <exception cref="DomainLayer.Exceptions.BadRequestException">
        /// The upload is not an accepted image or exceeds the storage size cap.
        /// </exception>
        Task<GymLogoUploadResult> UploadLogoAsync(
            int? actorUserId,
            int gymId,
            string fileName,
            Stream content,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Streams the gym's logo to a caller who may see that gym
        /// (GET /api/gyms/{gymId}/logo). Throws NotFound when none is stored, so the
        /// client can fall back to its bundled brand asset.
        /// </summary>
        Task<FileDownload> GetLogoAsync(int? actorUserId, int gymId, CancellationToken cancellationToken = default);
    }
}
