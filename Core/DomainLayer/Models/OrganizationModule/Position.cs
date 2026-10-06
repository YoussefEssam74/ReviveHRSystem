namespace DomainLayer.Models.OrganizationModule
{
    /// <summary>
    /// Represents a job title / role position cataloged within a gym (e.g., Personal Trainer, Receptionist, Cleaner).
    /// Includes job level and active status.
    /// </summary>
    public class Position : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public int? DepartmentId { get; set; }
        public virtual Department? Department { get; set; }

        public string Title { get; set; } = string.Empty;
        public string Level { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
    }
}

