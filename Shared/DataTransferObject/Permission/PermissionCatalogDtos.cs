namespace Shared.DataTransferObject.Permission
{
    /// <summary>
    /// GET /api/permissions response — the permission catalog served two ways from
    /// one payload: a flat item list ({ key, area }) for the super-admin permission
    /// grid, and an area-grouped module view ({ name, permissions[] }) for the My
    /// Access matrix. totalTracked is the catalog size (the "28 of 42" denominator).
    /// </summary>
    public class PermissionCatalogResponse
    {
        public required PermissionCatalogData Data { get; init; }
    }

    public class PermissionCatalogData
    {
        public required List<PermissionCatalogItem> Items { get; init; }
        public required List<PermissionModuleGroup> Modules { get; init; }
        public int TotalTracked { get; init; }
    }

    public class PermissionCatalogItem
    {
        public required string Key { get; init; }
        public required string Area { get; init; }
        public string? Description { get; init; }
    }

    public class PermissionModuleGroup
    {
        public required string Name { get; init; }
        public required List<string> Permissions { get; init; }
    }
}
