using DomainLayer.Models.EmployeeModule;

namespace DomainLayer.Models.OrganizationModule
{
    /// <summary>
    /// Many-to-many junction assigning an Employee as a member of a Team.
    /// An employee may belong to more than one team within their gym.
    /// </summary>
    public class TeamMember : BaseEntity
    {
        public int TeamId { get; set; }
        public virtual Team Team { get; set; } = null!;

        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;
    }
}
