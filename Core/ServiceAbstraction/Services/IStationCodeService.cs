using Shared.DataTransferObject.Gym;

namespace ServiceAbstraction.Services
{
    /// <summary>HR-side management of a gym's 6-digit station code.</summary>
    public interface IStationCodeService
    {
        /// <summary>Rotates the gym's station code, immediately invalidating the previous one.</summary>
        Task<StationCodeResponse> RotateAsync(int gymId, int? actorUserId, CancellationToken cancellationToken = default);

        /// <summary>Returns the gym's current active station code.</summary>
        Task<StationCodeResponse> GetCurrentAsync(int gymId, int actorUserId, CancellationToken cancellationToken = default);
    }
}
