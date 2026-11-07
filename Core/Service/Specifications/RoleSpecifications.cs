using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;

namespace Service.Specifications
{
    /// <summary>
    /// The roles list (7.1): optional name/description search, ordered by name,
    /// with RolePermissions included so the permission keys can be hydrated.
    /// User counts come from IUserAccessRepository (join table not reachable via
    /// the generic repository). A take of 0 means "no paging" — used for the
    /// companion count query.
    /// </summary>
    public sealed class RoleListSpec : BaseSpecification<Role, int>
    {
        public RoleListSpec(string? search, int skip, int take)
        {
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                Criteria = r => r.Name.ToLower().Contains(term)
                    || (r.Description != null && r.Description.ToLower().Contains(term));
            }

            AddInclude(r => r.RolePermissions);
            OrderBy = r => r.Name;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>One role with its permission joins (create/update/clone/archive paths).</summary>
    public sealed class RoleByIdSpec : BaseSpecification<Role, int>
    {
        public RoleByIdSpec(int roleId)
        {
            Criteria = r => r.Id == roleId;
            AddInclude(r => r.RolePermissions);
        }
    }

    /// <summary>Roles whose name matches exactly (case-insensitive) — duplicate checks and preset resolution.</summary>
    public sealed class RoleByNameSpec : BaseSpecification<Role, int>
    {
        public RoleByNameSpec(string name)
        {
            var clean = name.Trim().ToLower();
            Criteria = r => r.Name.ToLower() == clean;
        }
    }

    /// <summary>The full permission catalog ordered by area (key ordering is applied in memory).</summary>
    public sealed class PermissionCatalogSpec : BaseSpecification<Permission, int>
    {
        public PermissionCatalogSpec()
        {
            OrderBy = p => p.Area;
        }
    }

    /// <summary>
    /// The HR Team member list (GET /api/users): scoped to the actor's gyms,
    /// staff-only by default (non-Employee user types — the screen lists HR staff,
    /// the Employees directory covers the rest), optional name/email/username
    /// search and an Active/Suspended filter, ordered by display name with the
    /// EmployeeProfile included so names hydrate. Role, gym and permission data
    /// come from IUserAccessRepository (join tables not reachable via the generic
    /// repository). A take of 0 means "no paging" — the companion count query.
    /// </summary>
    public sealed class UserListSpec : BaseSpecification<User, int>
    {
        public UserListSpec(int[]? gymIds, string? type, string? search, bool? isActive, int skip, int take)
        {
            var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();
            var isAll = string.Equals(type?.Trim(), "all", StringComparison.OrdinalIgnoreCase);

            UserType? userType = type?.Trim().ToLowerInvariant() switch
            {
                null or "" or "staff" or "all" => null,
                "hr" => UserType.HR,
                "topmanagement" => UserType.TopManagement,
                "employee" => UserType.Employee,
                var other => throw new BadRequestException($"Unknown user type '{other}'."),
            };

            // Staff-only default: the screen lists HR staff, the Employees
            // directory covers self-service accounts.
            var staffOnly = userType is null && !isAll;

            // One predicate so EF can translate the whole thing to SQL —
            // null locals are captured as parameters (constant conditions).
            Criteria = u =>
                (gymIds == null || gymIds.Length == 0 || u.UserGymAccesses.Any(ug => gymIds.Contains(ug.GymId))) &&
                (userType == null || u.UserType == userType) &&
                (!staffOnly || u.UserType != UserType.Employee) &&
                (term == null
                    || u.Email.ToLower().Contains(term)
                    || u.UserName.ToLower().Contains(term)
                    || (u.EmployeeProfile != null && u.EmployeeProfile.FullName.ToLower().Contains(term)))
                && (isActive == null || u.IsActive == isActive);

            AddInclude(u => u.EmployeeProfile!);
            OrderBy = u => u.EmployeeProfile != null ? u.EmployeeProfile.FullName : u.UserName;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }
}
