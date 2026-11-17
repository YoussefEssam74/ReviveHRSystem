using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;

namespace Service.Services
{
    /// <summary>
    /// Small shared helpers for the api-spec-from-ui.md §5.2–§5.9 services. Mirrors the
    /// private helpers RecruitmentService keeps for §5.1 (actor resolution, ADR-003 gym
    /// scoping, page-size clamping, display names) so the newer services stay lean.
    /// </summary>
    internal static class HrPortalHelpers
    {
        internal const int DefaultPageSize = 20;
        internal const int MaxPageSize = 100;

        internal static string? NullIfBlank(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        internal static int NormalizePageSize(int pageSize, int fallback = DefaultPageSize) =>
            pageSize <= 0 ? fallback : Math.Min(pageSize, MaxPageSize);

        internal static string DisplayName(User user) =>
            NullIfBlank(user.UserName) ?? user.Email;

        internal static string BuildInitials(string fullName)
        {
            var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length == 0)
            {
                return "?";
            }

            return parts.Length == 1
                ? parts[0][..1].ToUpperInvariant()
                : $"{parts[0][..1]}{parts[^1][..1]}".ToUpperInvariant();
        }

        internal static async Task<User> ResolveActorAsync(IUnitOfWork unitOfWork, int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null or <= 0)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var actor = await unitOfWork.GetRepository<User, int>().GetByIdAsync(actorUserId.Value, cancellationToken);
            if (actor is null || !actor.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            return actor;
        }

        /// <summary>null = unrestricted (Top Management without a gym filter); empty array = matches nobody.</summary>
        internal static async Task<int[]> ResolveGymScopeAsync(IUnitOfWork unitOfWork, IUserAccessRepository userAccess, User actor, int? requestedGym, CancellationToken cancellationToken)
        {
            if (actor.UserType == UserType.TopManagement)
            {
                return requestedGym.HasValue ? [requestedGym.Value] : [];
            }

            var allowedIds = (await userAccess.GetGymAccessAsync(actor.Id, cancellationToken))
                .Select(a => a.GymId)
                .ToHashSet();
            if (requestedGym.HasValue)
            {
                if (!allowedIds.Contains(requestedGym.Value))
                {
                    throw new UnAuthorizedException("You are not assigned to this gym.");
                }

                return [requestedGym.Value];
            }

            return allowedIds.ToArray();
        }

        /// <summary>Resolves a gym by id or name, enforcing the actor's assignment (writes).</summary>
        internal static async Task<Gym> ResolveGymAsync(IUnitOfWork unitOfWork, IUserAccessRepository userAccess, User actor, int? gymId, string? gymName, CancellationToken cancellationToken = default)
        {
            if (gymId is null && NullIfBlank(gymName) is null)
            {
                throw new BadRequestException("Gym is required.");
            }

            Gym? gym;
            if (gymId is int id)
            {
                gym = await unitOfWork.GetRepository<Gym, int>().GetByIdAsync(id, cancellationToken);
            }
            else
            {
                var clean = NullIfBlank(gymName)!;
                var gyms = await unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken);
                gym = gyms.FirstOrDefault(g => string.Equals(g.Name.Trim(), clean, StringComparison.OrdinalIgnoreCase));
            }

            if (gym is null)
            {
                throw new BadRequestException("Unknown gym.");
            }

            if (actor.UserType != UserType.TopManagement &&
                !await userAccess.HasGymAccessAsync(actor.Id, gym.Id, cancellationToken))
            {
                throw new UnAuthorizedException("You are not assigned to this gym.");
            }

            return gym;
        }

        /// <summary>
        /// Read-filter gym param shared by the §5.6 queues: "all"/blank → null (no
        /// filter), a number → that id, otherwise a branch NAME resolved to its id
        /// (unknown → 400 "Gym not found."). The caller still runs the resolved id
        /// through ResolveGymScopeAsync, which enforces the actor's assignment.
        /// </summary>
        internal static async Task<int?> ResolveGymFilterAsync(IUnitOfWork unitOfWork, string? gymRaw, CancellationToken cancellationToken)
        {
            var raw = NullIfBlank(gymRaw);
            if (raw is null || string.Equals(raw, "all", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            if (int.TryParse(raw, out var gymId))
            {
                return gymId;
            }

            var gyms = await unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken);
            var match = gyms.FirstOrDefault(g => string.Equals(g.Name.Trim(), raw, StringComparison.OrdinalIgnoreCase));
            if (match is null)
            {
                throw new BadRequestException("Gym not found.");
            }

            return match.Id;
        }

        /// <summary>Plain gym lookup by name (no access enforcement — callers decide).</summary>
        internal static async Task<Gym?> FindGymByNameAsync(IUnitOfWork unitOfWork, string name, CancellationToken cancellationToken)
        {
            var clean = name.Trim();
            var gyms = await unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken);
            return gyms.FirstOrDefault(g => string.Equals(g.Name.Trim(), clean, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>Batch-loads display names for a page of nullable user ids.</summary>
        internal static async Task<Dictionary<int, string>> LoadUserDisplayNamesAsync(IUnitOfWork unitOfWork, IEnumerable<int?> userIds, CancellationToken cancellationToken)
        {
            var ids = userIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
            if (ids.Count == 0)
            {
                return [];
            }

            var names = new Dictionary<int, string>();
            foreach (var id in ids)
            {
                var user = await unitOfWork.GetRepository<User, int>().GetByIdAsync(id, cancellationToken);
                if (user is not null)
                {
                    names[id] = DisplayName(user);
                }
            }

            return names;
        }
    }
}
