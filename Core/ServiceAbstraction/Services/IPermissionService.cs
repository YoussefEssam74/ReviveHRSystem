using DomainLayer.Models.UserModule.Enums;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Effective feature access resolution for one user in one gym
    /// (ADR-003 Amendment 1). Precedence: Super Admin wildcard → per-gym
    /// individual grant → per-gym role bundle → global grant → None.
    /// </summary>
    public interface IPermissionService
    {
        /// <summary>
        /// Effective level of every catalog feature for (user, gym). Features with
        /// no grant anywhere are absent from the map (equivalent to None).
        /// </summary>
        Task<IReadOnlyDictionary<string, AccessLevel>> GetEffectiveLevelsAsync(
            int userId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>True when the user's effective level for the feature in the gym
        /// is at least <paramref name="requiredLevel"/>.</summary>
        Task<bool> HasAccessAsync(
            int userId, int gymId, string feature, AccessLevel requiredLevel, CancellationToken cancellationToken = default);
    }
}
