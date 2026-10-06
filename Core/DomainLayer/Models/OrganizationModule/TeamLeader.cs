using DomainLayer.Models.EmployeeModule;

namespace DomainLayer.Models.OrganizationModule
{
    /// <summary>
    /// Many-to-many junction mapping an Employee as a Team Leader of a Team.
    /// An employee can lead multiple teams; their managerial scope is the union of all their teams' members.
    /// </summary>
    public class TeamLeader : BaseEntity
    {
        public int TeamId { get; set; }
        public virtual Team Team { get; set; } = null!;

        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;
    }
}
