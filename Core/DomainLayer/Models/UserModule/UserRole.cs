using DomainLayer.Models.OrganizationModule;

namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Assigns a role to a user — the single place a role grant lives.
    ///
    /// <para><see cref="GymId"/> decides the reach:</para>
    /// <list type="bullet">
    /// <item><c>null</c> — the role applies platform-wide (what the HR console's
    /// "HR Team" page manages: a permission-key carrier that follows the user
    /// into every gym).</item>
    /// <item>set — the role is held in that gym only, and also decides the data
    /// scope there (ADR-003 Amendment 1): Branch Manager ⇒ gym scope,
    /// Team Leader ⇒ team scope. The same user can be a Branch Manager in gym A
    /// and a Team Leader in gym B.</item>
    /// </list>
    ///
    /// <para><see cref="RoleName"/> is the foreign key, not a role id, so the row
    /// reads as "user 4 is an Employee in gym 2" without a join.</para>
    /// </summary>
    public class UserRole
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        /// <summary>NULL = platform-wide grant; otherwise the gym the role is held in.</summary>
        public int? GymId { get; set; }
        public virtual Gym? Gym { get; set; }

        /// <summary>Name of the granted role; foreign key to <see cref="Role.Name"/>.</summary>
        public string RoleName { get; set; } = string.Empty;
        public virtual Role Role { get; set; } = null!;

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    }
}

