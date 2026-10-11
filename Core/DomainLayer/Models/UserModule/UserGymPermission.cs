using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule.Enums;

namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Individual per-gym feature grant (ADR-003 Amendment 1). Overrides the
    /// per-gym role bundle for the (user, gym, feature) triple it names.
    /// </summary>
    public class UserGymPermission
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public int PermissionId { get; set; }
        public virtual Permission Permission { get; set; } = null!;

        public AccessLevel Level { get; set; } = AccessLevel.None;

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    }
}
