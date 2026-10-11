using DomainLayer.Contracts;
using DomainLayer.Models.UserModule.Enums;
using ServiceAbstraction.Services;
using Shared.Authorization;

namespace Service.Services
{
    /// <summary>
    /// Effective feature access resolution (ADR-003 Amendment 1).
    /// Precedence, lowest to highest: global user grants → per-gym role bundle
    /// (max level across the user's per-gym roles) → per-gym individual grants
    /// (authoritative, replace the bundle). The Super Admin wildcard ('*') is
    /// detected from the same sources and grants Edit on everything.
    /// </summary>
    public class PermissionService(IUserAccessRepository userAccess) : IPermissionService
    {
        public async Task<IReadOnlyDictionary<string, AccessLevel>> GetEffectiveLevelsAsync(
            int userId, int gymId, CancellationToken cancellationToken = default)
        {
            var levels = new Dictionary<string, AccessLevel>(StringComparer.Ordinal);

            void ApplyMax(string feature, AccessLevel level)
            {
                if (string.IsNullOrEmpty(feature))
                {
                    return;
                }

                levels[feature] = levels.TryGetValue(feature, out var current) && current > level ? current : level;
            }

            foreach (var entry in await userAccess.GetGlobalLevelsAsync(userId, cancellationToken))
            {
                ApplyMax(entry.Feature, entry.Level);
            }

            foreach (var entry in await userAccess.GetGymRoleLevelsAsync(userId, gymId, cancellationToken))
            {
                ApplyMax(entry.Feature, entry.Level);
            }

            // Per-gym individual grants are authoritative for the features they name.
            foreach (var entry in await userAccess.GetGymGrantLevelsAsync(userId, gymId, cancellationToken))
            {
                if (!string.IsNullOrEmpty(entry.Feature))
                {
                    levels[entry.Feature] = entry.Level;
                }
            }

            // The wildcard ('*') is expanded into an explicit Edit on every catalog
            // feature so consumers (/api/me payload, HasAccessAsync callers) see a
            // complete map and never need to know about the sentinel key.
            if (levels.TryGetValue(Features.Wildcard, out var wildcardLevel) && wildcardLevel >= AccessLevel.Edit)
            {
                foreach (var feature in Features.All)
                {
                    levels[feature] = AccessLevel.Edit;
                }
            }

            return levels;
        }

        public async Task<bool> HasAccessAsync(
            int userId, int gymId, string feature, AccessLevel requiredLevel, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(feature))
            {
                return false;
            }

            var levels = await GetEffectiveLevelsAsync(userId, gymId, cancellationToken);

            if (levels.TryGetValue(Features.Wildcard, out var wildcard) && wildcard >= AccessLevel.Edit)
            {
                return true;
            }

            return levels.TryGetValue(feature, out var level) && level >= requiredLevel;
        }
    }
}
