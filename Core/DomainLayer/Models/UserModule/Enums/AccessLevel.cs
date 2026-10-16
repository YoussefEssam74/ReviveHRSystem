namespace DomainLayer.Models.UserModule.Enums
{
    /// <summary>
    /// Access level granted for a feature within one gym (ADR-003 Amendment 1).
    /// None = no access, View = read-only, Edit = full read/write (implies View).
    /// Levels are granted per gym via <see cref="UserGymPermission"/> rows or the
    /// per-gym role bundle (<see cref="UserGymRole"/> + RolePermission.Level).
    /// </summary>
    public enum AccessLevel
    {
        None = 0,
        View = 1,
        Edit = 2
    }
}
