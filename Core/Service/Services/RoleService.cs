using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Permission;
using Shared.DataTransferObject.Role;
using Shared.DataTransferObject.User;

namespace Service.Services
{
    /// <summary>
    /// Roles &amp; permissions admin (S2). Roles are named permission presets
    /// (Role.RolePermissions) managed through the Roles &amp; Permissions page;
    /// archiving a role flips the shadow IsDeleted flag so every global query
    /// filter (listing, join resolution) hides it without touching referencing
    /// rows. User-level assignment (direct permissions, single role, gym access)
    /// mutates the identity join tables through IUserAccessRepository.
    /// </summary>
    public sealed class RoleService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess) : IRoleService
    {
        // ------------------------------------------------------------------
        // Roles (7.1–7.6)
        // ------------------------------------------------------------------

        public async Task<RolesListResponse> GetRolesAsync(int? actorUserId, RoleListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "team.view", cancellationToken);

            var page = Math.Max(1, query.Page);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);
            var search = string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim();

            var repository = _unitOfWork.GetRepository<Role, int>();
            var roles = (await repository.GetAllAsync(
                new RoleListSpec(search, (page - 1) * pageSize, pageSize), cancellationToken)).ToList();
            var total = await repository.CountAsync(new RoleListSpec(search, 0, 0), cancellationToken);

            var keyById = await LoadPermissionKeysAsync(cancellationToken);
            var items = new List<RoleListItem>(roles.Count);
            foreach (var role in roles)
            {
                var keys = ResolveKeys(role, keyById);
                var usersCount = await _userAccess.CountUsersWithRoleAsync(role.Id, cancellationToken);
                items.Add(BuildItem(role, keys, usersCount));
            }

            return new RolesListResponse
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = (int)Math.Ceiling(total / (double)pageSize),
            };
        }

        public async Task<RoleDataResponse> CreateRoleAsync(int? actorUserId, CreateRoleRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "team.manage", cancellationToken);

            var name = NormalizeRequiredName(request.Name, "Role name");
            await EnsureNameAvailableAsync(name, excludeRoleId: null, cancellationToken);

            var permissionIds = new List<int>();
            if (request.CloneFromRoleId is int sourceRoleId)
            {
                var source = await _unitOfWork.GetRepository<Role, int>()
                    .GetByIdAsync(new RoleByIdSpec(sourceRoleId), cancellationToken)
                    ?? throw new NotFoundException("Source role not found.");
                permissionIds.AddRange(source.RolePermissions.Select(rp => rp.PermissionId));
            }

            if (request.Permissions is not null)
            {
                // An explicit grid selection wins over the cloned set.
                permissionIds = (await ResolvePermissionIdsAsync(request.Permissions, cancellationToken)).ToList();
            }

            var role = new Role
            {
                Name = name,
                Description = NormalizeDescription(request.Description),
                IsPreset = false,
                RolePermissions = permissionIds
                    .Distinct()
                    .Select(permissionId => new RolePermission { PermissionId = permissionId })
                    .ToList(),
            };

            await _unitOfWork.GetRepository<Role, int>().AddAsync(role, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var keyById = await LoadPermissionKeysAsync(cancellationToken);
            return new RoleDataResponse { Data = BuildItem(role, ResolveKeys(role, keyById), usersCount: 0) };
        }

        public async Task<RoleDataResponse> UpdateRoleAsync(int? actorUserId, int roleId, UpdateRoleRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "team.manage", cancellationToken);

            var role = await GetRoleAsync(roleId, cancellationToken);
            var name = NormalizeRequiredName(request.Name, "Role name");
            await EnsureNameAvailableAsync(name, excludeRoleId: role.Id, cancellationToken);

            role.Name = name;
            role.Description = NormalizeDescription(request.Description);

            if (request.Permissions is not null)
            {
                await ReplaceRolePermissionsAsync(role, request.Permissions, cancellationToken);
            }

            // The role and its join rows were materialized through this UnitOfWork's
            // DbContext, so mutations are tracked — no explicit Update needed.
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var keyById = await LoadPermissionKeysAsync(cancellationToken);
            var usersCount = await _userAccess.CountUsersWithRoleAsync(role.Id, cancellationToken);
            return new RoleDataResponse { Data = BuildItem(role, ResolveKeys(role, keyById), usersCount) };
        }

        public async Task<RolePermissionsResponse> SetRolePermissionsAsync(int? actorUserId, int roleId, SetRolePermissionsRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "team.manage", cancellationToken);

            var role = await GetRoleAsync(roleId, cancellationToken);
            await ReplaceRolePermissionsAsync(role, request.Permissions, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var keyById = await LoadPermissionKeysAsync(cancellationToken);
            return new RolePermissionsResponse
            {
                Data = new RolePermissionData
                {
                    Id = role.Id,
                    Permissions = ResolveKeys(role, keyById),
                },
            };
        }

        public async Task<RoleDataResponse> CloneRoleAsync(int? actorUserId, int roleId, CloneRoleRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "team.manage", cancellationToken);

            var source = await GetRoleAsync(roleId, cancellationToken);
            var name = NormalizeRequiredName(request.Name, "Role name");
            await EnsureNameAvailableAsync(name, excludeRoleId: null, cancellationToken);

            var permissionIds = source.RolePermissions
                .Select(rp => rp.PermissionId)
                .Distinct()
                .ToList();

            var role = new Role
            {
                Name = name,
                Description = source.Description,
                IsPreset = false,
                RolePermissions = permissionIds
                    .Select(permissionId => new RolePermission { PermissionId = permissionId })
                    .ToList(),
            };

            await _unitOfWork.GetRepository<Role, int>().AddAsync(role, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var keyById = await LoadPermissionKeysAsync(cancellationToken);
            return new RoleDataResponse { Data = BuildItem(role, ResolveKeys(role, keyById), usersCount: 0) };
        }

        public async Task ArchiveRoleAsync(int? actorUserId, int roleId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "team.manage", cancellationToken);

            var role = await GetRoleAsync(roleId, cancellationToken);

            // Archiving hides the role from every query filter, which would silently
            // strip its permissions from the assigned users — force reassignment first.
            var usersCount = await _userAccess.CountUsersWithRoleAsync(roleId, cancellationToken);
            if (usersCount > 0)
            {
                throw new BadRequestException(
                    $"Role '{role.Name}' is assigned to {usersCount} user(s). Reassign them before archiving.");
            }

            await _userAccess.ArchiveRoleAsync(roleId, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // ------------------------------------------------------------------
        // Permission catalog (6.7 / My Access matrix)
        // ------------------------------------------------------------------

        public async Task<PermissionCatalogResponse> GetPermissionCatalogAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "team.view", cancellationToken);

            var permissions = await _unitOfWork.GetRepository<Permission, int>()
                .GetAllAsync(new PermissionCatalogSpec(), cancellationToken);

            var items = permissions
                .Select(p => new PermissionCatalogItem { Key = p.Key, Area = p.Area, Description = p.Description })
                .OrderBy(p => p.Area, StringComparer.Ordinal)
                .ThenBy(p => p.Key, StringComparer.Ordinal)
                .ToList();

            var modules = items
                .GroupBy(p => p.Area, StringComparer.Ordinal)
                .Select(g => new PermissionModuleGroup
                {
                    Name = g.Key,
                    Permissions = g.Select(p => p.Key).ToList(),
                })
                .ToList();

            return new PermissionCatalogResponse
            {
                Data = new PermissionCatalogData
                {
                    Items = items,
                    Modules = modules,
                    TotalTracked = items.Count,
                },
            };
        }

        // ------------------------------------------------------------------
        // User-level assignment (6.4–6.6)
        // ------------------------------------------------------------------

        public async Task<UserAssignmentResponse> ReplaceUserPermissionsAsync(int? actorUserId, int userId, UserPermissionsRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "team.manage", cancellationToken);
            await EnsureUserAsync(userId, cancellationToken);

            var permissionIds = await ResolvePermissionIdsAsync(request.Permissions, cancellationToken);
            await _userAccess.ReplaceUserPermissionsAsync(userId, permissionIds, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new UserAssignmentResponse { Data = await BuildUserAssignmentAsync(userId, cancellationToken) };
        }

        public async Task<UserAssignmentResponse> ReplaceUserRolesAsync(int? actorUserId, int userId, UserRoleAssignmentRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "team.manage", cancellationToken);
            await EnsureUserAsync(userId, cancellationToken);

            var roleIds = new List<int>();
            if (request.RoleId is int roleId)
            {
                if (!string.IsNullOrWhiteSpace(request.RolePreset))
                {
                    throw new BadRequestException("Provide either roleId or rolePreset, not both.");
                }

                var role = await _unitOfWork.GetRepository<Role, int>().GetByIdAsync(roleId, cancellationToken)
                    ?? throw new NotFoundException("Role not found.");
                roleIds.Add(role.Id);
            }
            else if (!string.IsNullOrWhiteSpace(request.RolePreset))
            {
                var preset = request.RolePreset.Trim();

                // The create-user wizard's "no bundled role" label — clears roles.
                var isNoneLabel = string.Equals(preset, "Custom Granular Overrides", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(preset, "None", StringComparison.OrdinalIgnoreCase);

                if (!isNoneLabel)
                {
                    var matches = await _unitOfWork.GetRepository<Role, int>()
                        .GetAllAsync(new RoleByNameSpec(preset), cancellationToken);
                    var role = matches.FirstOrDefault()
                        ?? throw new BadRequestException($"Unknown role preset '{preset}'.");
                    roleIds.Add(role.Id);
                }
            }

            await _userAccess.ReplaceUserRolesAsync(userId, roleIds, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new UserAssignmentResponse { Data = await BuildUserAssignmentAsync(userId, cancellationToken) };
        }

        public async Task<UserAssignmentResponse> ReplaceUserGymAccessAsync(int? actorUserId, int userId, UserGymAccessRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "team.manage", cancellationToken);
            await EnsureUserAsync(userId, cancellationToken);

            var requestedGymIds = (request.GymIds ?? []).Where(id => id > 0).Distinct().ToList();
            var requestedNames = (request.Gyms ?? [])
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var desiredIds = new HashSet<int>();

            if (requestedGymIds.Count > 0 || requestedNames.Count > 0)
            {
                var activeGyms = (await _unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken))
                    .Where(g => g.Status == GymStatus.Active)
                    .ToList();

                var unknownIds = requestedGymIds.Where(id => activeGyms.All(g => g.Id != id)).ToList();
                if (unknownIds.Count > 0)
                {
                    throw new BadRequestException($"Unknown gym(s): {string.Join(", ", unknownIds)}.");
                }

                foreach (var gymName in requestedNames)
                {
                    var match = activeGyms.FirstOrDefault(g =>
                        string.Equals(g.Name.Trim(), gymName, StringComparison.OrdinalIgnoreCase));
                    if (match is null)
                    {
                        throw new BadRequestException($"Unknown gym(s): {gymName}.");
                    }

                    desiredIds.Add(match.Id);
                }

                desiredIds.UnionWith(requestedGymIds);
            }

            var current = await _userAccess.GetGymAccessAsync(userId, cancellationToken);
            var currentIds = current.Select(entry => entry.GymId).ToHashSet();

            foreach (var staleId in currentIds.Except(desiredIds).OrderBy(id => id))
            {
                await _userAccess.RemoveGymAccessAsync(userId, staleId, cancellationToken);
            }

            foreach (var addedId in desiredIds.Except(currentIds).OrderBy(id => id))
            {
                await _userAccess.AddGymAccessAsync(userId, addedId, cancellationToken);
            }

            return new UserAssignmentResponse { Data = await BuildUserAssignmentAsync(userId, cancellationToken) };
        }

        // ------------------------------------------------------------------
        // My Access profile (api-spec-from-ui.md §5.8)
        // ------------------------------------------------------------------

        public async Task<UserAccessProfileResponse> GetUserAccessProfileAsync(int? actorUserId, int userId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);

            // Self-service: any signed-in user may read their own access card.
            // Another user's card requires team.view (the My Access admin matrix).
            if (actor.Id != userId)
            {
                await _accessControl.EnsurePermissionAsync(actor.Id, "team.view", cancellationToken);
            }

            var target = await _unitOfWork.GetRepository<User, int>().GetByIdAsync(userId, cancellationToken)
                ?? throw new NotFoundException("User not found.");

            var roleIds = (await _userAccess.GetUserRoleIdsAsync(userId, cancellationToken)).ToList();
            string roleLabel;
            if (roleIds.Count > 0)
            {
                var primary = await _unitOfWork.GetRepository<Role, int>().GetByIdAsync(roleIds[0], cancellationToken);
                roleLabel = primary?.Name ?? ResolveUserTypeLabel(target.UserType);
            }
            else
            {
                roleLabel = ResolveUserTypeLabel(target.UserType);
            }

            var directKeys = (await _userAccess.GetUserDirectPermissionKeysAsync(userId, cancellationToken))
                .OrderBy(key => key, StringComparer.Ordinal)
                .ToList();
            var effectiveKeys = (await _userAccess.GetPermissionKeysAsync(userId, cancellationToken))
                .OrderBy(key => key, StringComparer.Ordinal)
                .ToList();
            var gyms = (await _userAccess.GetGymAccessAsync(userId, cancellationToken))
                .OrderBy(entry => entry.GymName, StringComparer.OrdinalIgnoreCase)
                .Select(entry => new UserAccessGymItem
                {
                    Id = entry.GymId,
                    Name = entry.GymName,
                    Branch = entry.Branch,
                })
                .ToList();

            var trackedCount = (await LoadPermissionKeysAsync(cancellationToken)).Count;

            return new UserAccessProfileResponse
            {
                Data = new UserAccessProfileData
                {
                    Id = target.Id,
                    Email = target.Email,
                    Role = roleLabel,
                    Permissions = directKeys,
                    Gyms = gyms,
                    EffectivePermissions = effectiveKeys,
                    GrantedCount = effectiveKeys.Count,
                    TrackedCount = trackedCount,
                },
            };
        }

        private static string ResolveUserTypeLabel(UserType userType) => userType.ToString();

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private async Task<User> ResolveActorAsync(int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var actor = await _unitOfWork.GetRepository<User, int>().GetByIdAsync(actorUserId.Value, cancellationToken);
            if (actor is null || !actor.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            return actor;
        }

        private async Task<Role> GetRoleAsync(int roleId, CancellationToken cancellationToken) =>
            await _unitOfWork.GetRepository<Role, int>().GetByIdAsync(new RoleByIdSpec(roleId), cancellationToken)
            ?? throw new NotFoundException("Role not found.");

        private async Task EnsureUserAsync(int userId, CancellationToken cancellationToken)
        {
            _ = await _unitOfWork.GetRepository<User, int>().GetByIdAsync(userId, cancellationToken)
                ?? throw new NotFoundException("User not found.");
        }

        private static string NormalizeRequiredName(string? name, string label)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new BadRequestException($"{label} is required.");
            }

            return name.Trim();
        }

        private static string? NormalizeDescription(string? description) =>
            string.IsNullOrWhiteSpace(description) ? null : description.Trim();

        private async Task EnsureNameAvailableAsync(string name, int? excludeRoleId, CancellationToken cancellationToken)
        {
            var matches = await _unitOfWork.GetRepository<Role, int>()
                .GetAllAsync(new RoleByNameSpec(name), cancellationToken);
            if (matches.Any(r => r.Id != excludeRoleId))
            {
                throw new BadRequestException($"A role named '{name}' already exists.");
            }
        }

        /// <summary>Id → key map of the tracked catalog (used to hydrate role permission keys).</summary>
        private async Task<Dictionary<int, string>> LoadPermissionKeysAsync(CancellationToken cancellationToken)
        {
            var permissions = await _unitOfWork.GetRepository<Permission, int>()
                .GetAllAsync(new PermissionCatalogSpec(), cancellationToken);
            return permissions.ToDictionary(p => p.Id, p => p.Key);
        }

        /// <summary>Validates requested keys against the catalog; unknown keys are a 400 listing them.</summary>
        private async Task<IReadOnlyList<int>> ResolvePermissionIdsAsync(IReadOnlyCollection<string?> keys, CancellationToken cancellationToken)
        {
            var requested = keys
                .Where(key => !string.IsNullOrWhiteSpace(key))
                .Select(key => key!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var catalog = await _unitOfWork.GetRepository<Permission, int>()
                .GetAllAsync(new PermissionCatalogSpec(), cancellationToken);
            var idByKey = catalog
                .GroupBy(p => p.Key, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);

            var unknown = requested.Where(key => !idByKey.ContainsKey(key)).ToList();
            if (unknown.Count > 0)
            {
                throw new BadRequestException($"Unknown permission key(s): {string.Join(", ", unknown)}.");
            }

            return requested.Select(key => idByKey[key]).Distinct().ToList();
        }

        /// <summary>Wholesale replacement of a role's permission joins (tracked-row diffing).</summary>
        private async Task ReplaceRolePermissionsAsync(Role role, IReadOnlyCollection<string?> keys, CancellationToken cancellationToken)
        {
            var desiredIds = (await ResolvePermissionIdsAsync(keys, cancellationToken)).ToHashSet();

            var stale = role.RolePermissions.Where(rp => !desiredIds.Contains(rp.PermissionId)).ToList();
            foreach (var row in stale)
            {
                role.RolePermissions.Remove(row);
            }

            var existingIds = role.RolePermissions.Select(rp => rp.PermissionId).ToHashSet();
            foreach (var permissionId in desiredIds.Where(id => !existingIds.Contains(id)))
            {
                role.RolePermissions.Add(new RolePermission { PermissionId = permissionId });
            }

            await Task.CompletedTask;
        }

        /// <summary>Sorted permission keys of a role, hydrated from the catalog map.</summary>
        private static List<string> ResolveKeys(Role role, IReadOnlyDictionary<int, string> keyById) =>
            role.RolePermissions
                .Select(rp => keyById.TryGetValue(rp.PermissionId, out var key) ? key : null)
                .Where(key => key is not null)
                .Select(key => key!)
                .Distinct(StringComparer.Ordinal)
                .OrderBy(key => key, StringComparer.Ordinal)
                .ToList();

        private static RoleListItem BuildItem(Role role, List<string> keys, int usersCount) => new()
        {
            Id = role.Id,
            Name = role.Name,
            Description = role.Description,
            // Archived roles are filtered out everywhere, so every visible role is active.
            Status = "Active",
            PermissionsCount = keys.Count,
            UsersCount = usersCount,
            IsEmpty = keys.Count == 0,
            IsPreset = role.IsPreset,
            Permissions = keys,
        };

        private async Task<UserAssignmentData> BuildUserAssignmentAsync(int userId, CancellationToken cancellationToken)
        {
            var roleIds = (await _userAccess.GetUserRoleIdsAsync(userId, cancellationToken)).ToList();
            var directKeys = (await _userAccess.GetUserDirectPermissionKeysAsync(userId, cancellationToken))
                .OrderBy(key => key, StringComparer.Ordinal)
                .ToList();
            var effectiveKeys = (await _userAccess.GetPermissionKeysAsync(userId, cancellationToken))
                .OrderBy(key => key, StringComparer.Ordinal)
                .ToList();
            var gymIds = (await _userAccess.GetGymAccessAsync(userId, cancellationToken))
                .Select(entry => entry.GymId)
                .ToList();

            int? primaryRoleId = roleIds.Count > 0 ? roleIds[0] : null;
            string? rolePreset = null;
            if (primaryRoleId is int roleId)
            {
                rolePreset = (await _unitOfWork.GetRepository<Role, int>().GetByIdAsync(roleId, cancellationToken))?.Name;
            }

            return new UserAssignmentData
            {
                UserId = userId,
                RoleId = primaryRoleId,
                RolePreset = rolePreset,
                Permissions = directKeys,
                EffectivePermissions = effectiveKeys,
                Count = directKeys.Count,
                GymIds = gymIds,
            };
        }
    }
}
