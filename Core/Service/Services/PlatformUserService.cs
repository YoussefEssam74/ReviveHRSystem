using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.Platform;

namespace Service.Services
{
    /// <summary>
    /// The platform-wide user directory and account lifecycle.
    ///
    /// Scope rule: Top Management reaches every account. HR Manager reaches HR and employee
    /// accounts (it is the platform HR lead) but can never create, suspend or reset another
    /// HR Manager — that stays exclusive to Top Management.
    /// </summary>
    public sealed class PlatformUserService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess,
        IPlatformReadRepository _readModel,
        IPasswordHasher _passwordHasher) : IPlatformUserService
    {
        /// <summary>Temporary password handed to a new account until the admin resets it.</summary>
        private const string DefaultNewAccountPassword = "Revive!2026";

        private static readonly IReadOnlySet<int> NoScope = new HashSet<int>();

        // ------------------------------------------------------------------
        // Directory
        // ------------------------------------------------------------------

        public async Task<PlatformUsersResponse> GetUsersAsync(int? actorUserId, PlatformUserListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.users.view", cancellationToken);

            var page = Math.Max(1, query.PageNumber);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);

            var companyFilter = await NormalizeCompanyFilterAsync(query.CompanyId, cancellationToken);
            var repository = _unitOfWork.GetRepository<User, int>();

            var users = (await repository.GetAllAsync(
                new PlatformUserListSpec(query.Search, query.Role, query.Status, companyFilter, (page - 1) * pageSize, pageSize),
                cancellationToken)).ToList();

            var total = await repository.CountAsync(
                new PlatformUserCountSpec(query.Search, query.Role, query.Status, companyFilter),
                cancellationToken);

            var totals = await _readModel.GetUserTotalsAsync(cancellationToken);
            var companyNames = await _readModel.GetCompanyNamesAsync(cancellationToken);
            var companyMap = await _readModel.GetUserCompanyMapAsync(cancellationToken);
            var permissionCounts = await _readModel.GetUserPermissionCountsAsync(cancellationToken);
            var roleNames = (await _unitOfWork.GetRepository<Role, int>().GetAllAsync(cancellationToken))
                .GroupBy(r => r.Name, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => (Id: g.First().Id, g.First().IsPreset), StringComparer.Ordinal);

            var items = users.Select(u => BuildListItem(u, companyNames, companyMap, permissionCounts, roleNames)).ToList();

            return new PlatformUsersResponse
            {
                Items = items,
                Counts = new PlatformUserCountsDto
                {
                    Total = totals.Total,
                    HrManagers = totals.HrManagers,
                    Hr = totals.Hr,
                    BranchManagers = totals.BranchManagers,
                    TeamLeaders = totals.TeamLeaders,
                    Employees = totals.Employees,
                    Active = totals.Active,
                    Suspended = totals.Suspended,
                },
                Page = page,
                PageSize = pageSize,
                TotalCount = total,
                TotalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)),
            };
        }

        public async Task<PlatformUserDetailResponse> GetUserAsync(int? actorUserId, int userId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.users.view", cancellationToken);

            return await BuildDetailAsync(userId, cancellationToken);
        }

        // ------------------------------------------------------------------
        // Account creation
        // ------------------------------------------------------------------

        public async Task<CreateHrManagerResponse> CreateHrManagerAsync(int? actorUserId, CreateHrManagerRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);

            // Deliberately its own key: an HR Manager holds users.manage but must not mint
            // another HR Manager.
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.hr_manager.manage", cancellationToken);

            var name = RequireText(request.FullName, "Full name");
            var email = RequireEmail(request.Email);

            await EnsureEmailAvailableAsync(email, cancellationToken);

            var roleRepository = _unitOfWork.GetRepository<Role, int>();
            var presetRole = request.PresetRoleId is int roleId
                ? await roleRepository.GetByIdAsync(roleId, cancellationToken)
                  ?? throw new NotFoundException("Role not found.")
                : await roleRepository.GetByIdAsync(new RoleByNameSpec(RoleNames.HrManager), cancellationToken);

            if (presetRole is null)
            {
                throw new BadRequestException("The HR Manager preset role has not been seeded yet.");
            }

            var user = new User
            {
                Email = email,
                UserName = name,
                PasswordHash = _passwordHasher.Hash(DefaultNewAccountPassword),
                UserType = UserType.HRManager,
                IsActive = true,
            };

            await _unitOfWork.GetRepository<User, int>().AddAsync(user, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await _userAccess.ReplaceUserRolesAsync(user.Id, [presetRole.Id], cancellationToken);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Created HR Manager account",
                category: "User",
                severity: "info",
                entityType: "User",
                entityId: user.Id,
                companyId: null,
                gymId: null,
                target: $"{name} · all gym accounts",
                detail: $"Preset {presetRole.Name}. {(request.SendInvite ? "Activation invite queued." : "Invite withheld.")} "
                        + "Scope covers every company.",
                values: new { Email = email, Preset = presetRole.Name, request.SendInvite },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new CreateHrManagerResponse
            {
                Id = user.Id,
                FullName = name,
                Email = email,
                UserType = nameof(UserType.HRManager),
                Status = request.SendInvite ? "Invited" : "Active",
                Scope = "AllCompanies",
                InviteSent = request.SendInvite,
            };
        }

        public async Task<PlatformUserDetailResponse> CreateUserAsync(int? actorUserId, CreatePlatformUserRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.users.manage", cancellationToken);

            var userType = request.UserType?.Trim().ToLowerInvariant() switch
            {
                "hr" => UserType.HR,
                "employee" => UserType.Employee,
                "hrmanager" or "hr manager" => throw new BadRequestException(
                    "HR Manager accounts are created through the dedicated HR Manager endpoint."),
                _ => throw new BadRequestException("User type must be HR or Employee."),
            };

            var name = RequireText(request.FullName, "Full name");
            var email = RequireEmail(request.Email);
            await EnsureEmailAvailableAsync(email, cancellationToken);

            var companyIds = request.CompanyIds?.Distinct().ToList() ?? [];
            if (userType == UserType.HR && companyIds.Count == 0)
            {
                throw new BadRequestException("An HR account must be assigned to at least one company.");
            }

            var branches = await ResolveBranchesAsync(companyIds, cancellationToken);

            var permissionIds = new List<int>();
            if (request.PermissionKeys is { Count: > 0 } keys)
            {
                var catalog = (await _unitOfWork.GetRepository<Permission, int>().GetAllAsync(cancellationToken)).ToList();
                var unknown = keys.Where(k => catalog.All(p => !string.Equals(p.Key, k, StringComparison.Ordinal))).ToList();
                if (unknown.Count > 0)
                {
                    throw new BadRequestException($"Unknown permission key(s): {string.Join(", ", unknown)}.");
                }

                permissionIds = catalog.Where(p => keys.Contains(p.Key, StringComparer.Ordinal)).Select(p => p.Id).ToList();
            }

            var user = new User
            {
                Email = email,
                UserName = name,
                PasswordHash = _passwordHasher.Hash(DefaultNewAccountPassword),
                UserType = userType,
                IsActive = true,
            };

            await _unitOfWork.GetRepository<User, int>().AddAsync(user, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            if (request.RoleId is int roleId)
            {
                await _userAccess.ReplaceUserRolesAsync(user.Id, [roleId], cancellationToken);
            }

            if (permissionIds.Count > 0)
            {
                await _userAccess.ReplaceUserPermissionsAsync(user.Id, permissionIds, cancellationToken);
            }

            foreach (var branch in branches)
            {
                await _userAccess.AddGymAccessAsync(user.Id, branch.Id, cancellationToken);
            }

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Created user account",
                category: "User",
                severity: "info",
                entityType: "User",
                entityId: user.Id,
                companyId: companyIds.Count == 1 ? companyIds[0] : null,
                gymId: branches.FirstOrDefault()?.Id,
                target: $"{name} · {string.Join(", ", branches.Select(b => b.Name).DefaultIfEmpty("no branch"))}",
                detail: $"{(userType == UserType.HR ? "HR" : "Employee")} account provisioned with {branches.Count} branch assignment(s).",
                values: new { Email = email, UserType = userType.ToString(), request.RoleId, CompanyIds = companyIds },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return await BuildDetailAsync(user.Id, cancellationToken);
        }

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------

        public async Task<ChangePlatformUserStatusResponse> ChangeStatusAsync(int? actorUserId, int userId, ChangePlatformUserStatusRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.users.manage", cancellationToken);

            if (userId == actor.Id)
            {
                throw new BadRequestException("You cannot change the status of your own account.");
            }

            var repository = _unitOfWork.GetRepository<User, int>();
            var user = await repository.GetByIdAsync(userId, cancellationToken)
                       ?? throw new NotFoundException("User not found.");

            // Suspending an HR Manager is a Top-Management-only action.
            if (user.UserType == UserType.HRManager)
            {
                await _accessControl.EnsurePermissionAsync(actor.Id, "platform.hr_manager.manage", cancellationToken);
            }

            var suspend = request.Status?.Trim().ToLowerInvariant() switch
            {
                "suspended" or "suspended " or "inactive" => true,
                "active" or "restored" => false,
                _ => throw new BadRequestException("Status must be Active or Suspended."),
            };

            if (suspend && string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new BadRequestException("A reason is required when suspending an account.");
            }

            user.IsActive = !suspend;
            repository.Update(user);

            var revoked = suspend ? await RevokeUserSessionsAsync(userId, cancellationToken) : 0;

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: suspend ? "Suspended user account" : "Restored user account",
                category: "Access",
                severity: suspend ? "warning" : "info",
                entityType: "User",
                entityId: user.Id,
                companyId: null,
                gymId: null,
                target: $"{user.UserName} · {user.Email}",
                detail: suspend
                    ? $"Account suspended. {revoked} session(s) revoked. Reason: {request.Reason?.Trim()}"
                    : "Account restored with its previous permissions.",
                values: new { Suspended = suspend, Reason = request.Reason, SessionsRevoked = revoked },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new ChangePlatformUserStatusResponse
            {
                Id = user.Id,
                Status = suspend ? "Suspended" : "Active",
                SessionsRevoked = revoked,
                ChangedAt = DateTime.UtcNow,
            };
        }

        public async Task<ResetPlatformUserPasswordResponse> ResetPasswordAsync(int? actorUserId, int userId, ResetPlatformUserPasswordRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.users.reset_password", cancellationToken);

            var repository = _unitOfWork.GetRepository<User, int>();
            var user = await repository.GetByIdAsync(userId, cancellationToken)
                       ?? throw new NotFoundException("User not found.");

            if (user.UserType == UserType.HRManager)
            {
                await _accessControl.EnsurePermissionAsync(actor.Id, "platform.hr_manager.manage", cancellationToken);
            }

            // The new password is never returned or logged — only the reset signal is.
            user.PasswordHash = _passwordHasher.Hash(DefaultNewAccountPassword);
            user.FailedLoginAttempts = 0;
            user.LockoutEnd = null;
            repository.Update(user);

            var revoked = request.RevokeSessions ? await RevokeUserSessionsAsync(userId, cancellationToken) : 0;

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Reset user password",
                category: "Access",
                severity: "warning",
                entityType: "User",
                entityId: user.Id,
                companyId: null,
                gymId: null,
                target: $"{user.UserName} · {user.Email}",
                detail: $"Temporary password issued; forced change at next sign-in. {revoked} session(s) revoked.",
                values: new { SessionsRevoked = revoked },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new ResetPlatformUserPasswordResponse
            {
                UserId = user.Id,
                Email = user.Email,
                ResetLinkSent = true,
                SessionsRevoked = revoked,
            };
        }

        public async Task<RevokeSessionsResponse> RevokeSessionsAsync(int? actorUserId, int userId, RevokeSessionsRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.users.manage", cancellationToken);

            var user = await _unitOfWork.GetRepository<User, int>().GetByIdAsync(userId, cancellationToken)
                       ?? throw new NotFoundException("User not found.");

            var revoked = await RevokeUserSessionsAsync(userId, cancellationToken);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Revoked user sessions",
                category: "Access",
                severity: "warning",
                entityType: "User",
                entityId: user.Id,
                companyId: null,
                gymId: null,
                target: $"{user.UserName} · {user.Email}",
                detail: $"{revoked} refresh token(s) revoked. Reason: {request.Reason?.Trim() ?? "not given"}.",
                values: new { SessionsRevoked = revoked, request.Reason },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new RevokeSessionsResponse { UserId = userId, SessionsRevoked = revoked };
        }

        public async Task<ReplaceGymAccessResponse> ReplaceGymAccessAsync(int? actorUserId, int userId, ReplaceGymAccessRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "gym.hr_staff.assign", cancellationToken);

            var user = await _unitOfWork.GetRepository<User, int>().GetByIdAsync(userId, cancellationToken)
                       ?? throw new NotFoundException("User not found.");

            // Branch-scoped access is the HR model. Employees are bound by their employment
            // record and platform roles reach everything anyway.
            if (user.UserType != UserType.HR)
            {
                throw new BadRequestException("Only HR accounts carry branch assignments.");
            }

            var requested = request.BranchIds.Distinct().ToList();

            if (requested.Count > 0)
            {
                var known = (await _unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Gym, int>()
                    .GetAllAsync(cancellationToken))
                    .Select(g => g.Id)
                    .ToHashSet();

                var unknown = requested.Where(id => !known.Contains(id)).ToList();
                if (unknown.Count > 0)
                {
                    throw new BadRequestException($"Unknown branch id(s): {string.Join(", ", unknown)}.");
                }
            }

            var existing = (await _userAccess.GetGymAccessAsync(userId, cancellationToken))
                .Select(a => a.GymId)
                .ToList();

            var added = requested.Except(existing).ToList();
            var removed = existing.Except(requested).ToList();

            foreach (var branchId in added)
            {
                await _userAccess.AddGymAccessAsync(userId, branchId, cancellationToken);
            }

            foreach (var branchId in removed)
            {
                await _userAccess.RemoveGymAccessAsync(userId, branchId, cancellationToken);
            }

            if (added.Count > 0 || removed.Count > 0)
            {
                await PlatformHelpers.WriteAuditAsync(
                    _unitOfWork, actor,
                    action: "Changed HR branch assignments",
                    category: "User",
                    severity: "warning",
                    entityType: "User",
                    entityId: user.Id,
                    companyId: null,
                    gymId: null,
                    target: $"{user.UserName} · {user.Email}",
                    detail: $"Branch access replaced. {added.Count} granted, {removed.Count} revoked.",
                    values: new { Added = added, Removed = removed },
                    cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new ReplaceGymAccessResponse
            {
                UserId = userId,
                BranchIds = requested,
                Added = added,
                Removed = removed,
            };
        }

        // ------------------------------------------------------------------
        // Internals
        // ------------------------------------------------------------------

        private async Task<PlatformUserDetailResponse> BuildDetailAsync(int userId, CancellationToken cancellationToken)
        {
            var user = await _unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new PlatformUserByIdSpec(userId), cancellationToken)
                ?? throw new NotFoundException("User not found.");

            var roleRepository = await _unitOfWork.GetRepository<Role, int>().GetAllAsync(cancellationToken);
            var roleById = roleRepository.ToDictionary(r => r.Id, r => r);
            var roleIdByName = roleRepository
                .GroupBy(r => r.Name, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.Ordinal);

            // The displayed role is the platform-wide grant; a per-gym role only describes
            // the user inside that branch, and the detail page shows it per company.
            var platformRoleName = user.UserRoles
                .FirstOrDefault(ur => ur.GymId == null)?.RoleName;

            Role? role = null;
            if (platformRoleName is not null && roleIdByName.TryGetValue(platformRoleName, out var platformRoleId))
            {
                roleById.TryGetValue(platformRoleId, out role);
            }

            var companyNames = await _readModel.GetCompanyNamesAsync(cancellationToken);
            var companyMap = await _readModel.GetUserCompanyMapAsync(cancellationToken);
            var companyIds = companyMap.TryGetValue(user.Id, out var ids) ? ids : [];

            var companyBranches = await _unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Gym, int>()
                .GetAllAsync(cancellationToken);
            var branchById = companyBranches.ToDictionary(g => g.Id, g => g);

            var primaryAccess = user.UserGymAccesses.FirstOrDefault();
            var primaryBranch = primaryAccess is not null && branchById.TryGetValue(primaryAccess.GymId, out var branch)
                ? branch
                : null;

            var permissionKeys = await _userAccess.GetPermissionKeysAsync(user.Id, cancellationToken);
            var catalog = (await _unitOfWork.GetRepository<Permission, int>().GetAllAsync(cancellationToken))
                .ToDictionary(p => p.Key, p => p.Area, StringComparer.Ordinal);

            var groups = permissionKeys
                .GroupBy(key => catalog.TryGetValue(key, out var area) ? area : "Other")
                .ToDictionary(g => g.Key, g => g.Count());

            var auditRows = await _unitOfWork.GetRepository<DomainLayer.Models.AuditModule.AuditLog, int>()
                .GetAllAsync(cancellationToken);

            var recent = auditRows
                .Where(a => a.UserId == user.Id)
                .OrderByDescending(a => a.Timestamp)
                .Take(6)
                .Select(a => new PlatformUserAuditRef
                {
                    Id = a.Id,
                    Action = a.ActionLabel ?? a.Action,
                    Target = a.Target,
                    Severity = a.Severity,
                    OccurredAt = a.Timestamp,
                })
                .ToList();

            return new PlatformUserDetailResponse
            {
                Id = user.Id,
                Name = user.UserName,
                Email = user.Email,
                Phone = null,
                Initials = PlatformHelpers.InitialsOf(user.UserName),
                UserType = user.UserType.ToString(),
                Role = role?.Name ?? PlatformHelpers.RoleLabel(user, null),
                RoleId = role?.Id,
                RoleType = role is null ? null : role.IsPreset ? "System" : "Custom",
                RoleScope = role is null ? null : ScopeOf(user.UserType),
                Status = PlatformHelpers.UserStatusLabel(user, user.LastLoginAt is not null),
                Company = companyIds.Count == 1 && companyNames.TryGetValue(companyIds[0], out var companyName)
                    ? new PlatformUserCompanyRef { Id = companyIds[0], Name = companyName }
                    : null,
                Branch = primaryBranch is null
                    ? null
                    : new PlatformUserBranchRef { Id = primaryBranch.Id, Name = primaryBranch.Name, Code = $"BR-{primaryBranch.Id}" },
                Companies = companyIds
                    .Where(companyNames.ContainsKey)
                    .Select(id => new HrStaffCompanyRef { Id = id, Name = companyNames[id] })
                    .ToList(),
                Preset = role?.IsPreset == true ? $"Standard {role.Name}" : null,
                JoinedOn = null,
                CreatedBy = user.UserType is UserType.TopManagement or UserType.HRManager ? "Super Admin" : "HR Manager",
                LastLoginAt = user.LastLoginAt,
                Permissions = new PlatformUserPermissionSummaryDto
                {
                    Total = permissionKeys.Count,
                    Groups = groups,
                },
                RecentAudit = recent,
            };
        }

        private static PlatformUserListItem BuildListItem(
            User user,
            IReadOnlyDictionary<int, string> companyNames,
            IReadOnlyDictionary<int, IReadOnlyList<int>> companyMap,
            IReadOnlyDictionary<int, int> permissionCounts,
            IReadOnlyDictionary<string, (int Id, bool IsPreset)> roleIdByName)
        {
            var platformRoleName = user.UserRoles.FirstOrDefault(ur => ur.GymId == null)?.RoleName;
            var roleId = 0;
            var isPreset = false;
            if (platformRoleName is not null && roleIdByName.TryGetValue(platformRoleName, out var role))
            {
                roleId = role.Id;
                isPreset = role.IsPreset;
            }

            var companyIds = companyMap.TryGetValue(user.Id, out var ids) ? ids : [];
            var primaryAccess = user.UserGymAccesses.FirstOrDefault();

            return new PlatformUserListItem
            {
                Id = user.Id,
                Name = user.UserName,
                Email = user.Email,
                Initials = PlatformHelpers.InitialsOf(user.UserName),
                UserType = user.UserType.ToString(),
                Role = platformRoleName ?? PlatformHelpers.RoleLabel(user, null),
                RoleId = roleId != 0 ? roleId : null,
                Preset = isPreset ? $"Standard {platformRoleName}" : null,
                Scope = ScopeOf(user.UserType),
                Companies = companyIds
                    .Where(companyNames.ContainsKey)
                    .Select(id => new HrStaffCompanyRef { Id = id, Name = companyNames[id] })
                    .ToList(),
                Branch = primaryAccess?.Gym?.Name,
                BranchCode = primaryAccess is null ? null : $"BR-{primaryAccess.GymId}",
                Status = PlatformHelpers.UserStatusLabel(user, user.LastLoginAt is not null),
                LastLoginAt = user.LastLoginAt,
                CreatedOn = null,
                CreatedBy = user.UserType is UserType.TopManagement or UserType.HRManager ? "Super Admin" : "HR Manager",
                PermissionCount = permissionCounts.TryGetValue(user.Id, out var count) ? count : 0,
            };
        }

        private static string ScopeOf(UserType userType) => userType switch
        {
            UserType.TopManagement or UserType.HRManager => "AllCompanies",
            _ => "AssignedCompanies",
        };

        /// <summary>
        /// Null means "no company restriction" (platform-wide roles included implicitly by
        /// the spec). "platform" selects accounts with no company binding.
        /// </summary>
        private async Task<IReadOnlyCollection<int>?> NormalizeCompanyFilterAsync(string? companyId, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(companyId) || string.Equals(companyId, "all", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            if (string.Equals(companyId, "platform", StringComparison.OrdinalIgnoreCase))
            {
                return NoScope;
            }

            if (!int.TryParse(companyId, out var parsed))
            {
                throw new BadRequestException("Company filter must be a company id or 'platform'.");
            }

            _ = await _unitOfWork.GetRepository<DomainLayer.Models.PlatformModule.Company, int>()
                    .GetByIdAsync(parsed, cancellationToken)
                ?? throw new NotFoundException("Company not found.");

            return [parsed];
        }

        private async Task<List<DomainLayer.Models.OrganizationModule.Gym>> ResolveBranchesAsync(
            IReadOnlyCollection<int> companyIds,
            CancellationToken cancellationToken)
        {
            if (companyIds.Count == 0)
            {
                return [];
            }

            var branches = (await _unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Gym, int>()
                .GetAllAsync(cancellationToken)).ToList();

            var companies = await _unitOfWork.GetRepository<DomainLayer.Models.PlatformModule.Company, int>()
                .GetAllAsync(cancellationToken);

            var known = companies.Select(c => c.Id).ToHashSet();
            var unknown = companyIds.Where(id => !known.Contains(id)).ToList();
            if (unknown.Count > 0)
            {
                throw new NotFoundException($"Company id(s) not found: {string.Join(", ", unknown)}.");
            }

            // One user can carry a grant per branch; use each company's first active branch
            // so an HR account opens a workspace without picking a branch first.
            return branches
                .Where(b => companyIds.Contains(b.CompanyId))
                .GroupBy(b => b.CompanyId)
                .Select(g => g.OrderBy(b => b.Id).First())
                .ToList();
        }

        private async Task<int> RevokeUserSessionsAsync(int userId, CancellationToken cancellationToken)
        {
            var repository = _unitOfWork.GetRepository<RefreshToken, int>();
            var tokens = await repository.GetAllAsync(cancellationToken);

            var revoked = 0;
            foreach (var token in tokens.Where(t => t.UserId == userId && t.RevokedAtUtc == null))
            {
                token.RevokedAtUtc = DateTime.UtcNow;
                repository.Update(token);
                revoked++;
            }

            return revoked;
        }

        private async Task EnsureEmailAvailableAsync(string email, CancellationToken cancellationToken)
        {
            var existing = await _unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserByEmailSpec(email), cancellationToken);

            if (existing is not null)
            {
                throw new BadRequestException("That email already belongs to a user.");
            }
        }

        private static string RequireText(string? value, string label) =>
            string.IsNullOrWhiteSpace(value)
                ? throw new BadRequestException($"{label} is required.")
                : value.Trim();

        private static string RequireEmail(string? value)
        {
            var email = RequireText(value, "Email").ToLowerInvariant();

            if (!email.Contains('@') || email.StartsWith('@') || email.EndsWith('@') || !email.Contains('.'))
            {
                throw new BadRequestException("Enter a valid email address.");
            }

            return email;
        }
    }
}
