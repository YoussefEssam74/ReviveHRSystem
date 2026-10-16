using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule.Enums;

namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Join table assigning a Role to a user for ONE gym (ADR-003 Amendment 1).
    /// The same user can be a Branch Manager at gym A and a Team Leader at gym B.
    /// The per-gym role decides the data scope: Branch Manager ⇒ gym scope,
    /// Team Leader ⇒ team scope (leader's TeamLeaders row in that gym).
    /// </summary>
    public class UserGymRole
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public int RoleId { get; set; }
        public virtual Role Role { get; set; } = null!;

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    }
}
