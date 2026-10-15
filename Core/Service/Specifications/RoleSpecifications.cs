using DomainLayer.Contracts;
using DomainLayer.Models.UserModule;

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
}
