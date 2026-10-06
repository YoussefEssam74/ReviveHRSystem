namespace DomainLayer.Models.OrganizationModule
{
    /// <summary>
    /// Represents an organizational department scoped to a specific gym (e.g., Fitness, Front Desk, Maintenance).
    /// </summary>
    public class Department : BaseEntity
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public string Name { get; set; } = string.Empty;
    }
}
