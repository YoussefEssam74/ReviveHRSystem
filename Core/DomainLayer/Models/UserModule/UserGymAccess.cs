using DomainLayer.Models.OrganizationModule;

namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Join table defining which physical Gyms a User is allowed to view, access, or operate on.
    /// Enforces multi-gym data isolation and gym-scoped authorization.
    /// </summary>
    public class UserGymAccess
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    }
}
