using DomainLayer.Models.EmployeeModule;

namespace DomainLayer.Models.OrganizationModule
{
    /// <summary>
    /// Marks an Employee assigned to a single Team as one of that team's leaders.
    /// </summary>
    public class TeamLeader : BaseEntity<int>
    {
        public int TeamId { get; set; }
        public virtual Team Team { get; set; } = null!;

        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;
    }
}

