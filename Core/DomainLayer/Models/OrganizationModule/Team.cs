using DomainLayer.Models.EmployeeModule;

namespace DomainLayer.Models.OrganizationModule
{
    /// <summary>
    /// Represents a sub-gym operational group of employees under a Team Leader (e.g., Morning Shift Floor Team).
    /// Always belongs strictly to one gym and cannot span gyms.
    /// </summary>
    public class Team : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;

        public virtual ICollection<TeamLeader> TeamLeaders { get; set; } = new List<TeamLeader>();
        public virtual ICollection<Employee> Members { get; set; } = new List<Employee>();
    }
}

