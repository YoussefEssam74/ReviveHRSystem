using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.PlatformModule;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.OrganizationModule
{
    /// <summary>
    /// Represents an individual fitness branch / gym location in the multi-gym platform.
    /// Manages shift cycle duration (default 10 days), annual raise percentage, and branch status.
    /// A branch always belongs to exactly one <see cref="Company"/> — the subscribing gym
    /// account that owns the subscription, seat limit and invoices.
    /// </summary>
    public class Gym : BaseEntity<int>
    {
        /// <summary>The company (tenant) this branch belongs to.</summary>
        public int CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string Name { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string? ContactInfo { get; set; }
        public int ShiftCycleLengthDays { get; set; } = 10;
        public GymStatus Status { get; set; } = GymStatus.Active;

        public decimal? AnnualIncreasePercent { get; set; }
        public AnnualIncreaseAnchorDate AnnualIncreaseAnchorDate { get; set; } = AnnualIncreaseAnchorDate.HireAnniversary;

        /// <summary>
        /// HR-set monthly cap of excused Late Attendance / Early Leave hours, static for
        /// every employee of the gym. Late attendance and early leave share one budget.
        /// </summary>
        public decimal ExcusedLateHoursCapPerMonth { get; set; } = 4;

        // Navigations
        public virtual ICollection<UserGymAccess> UserGymAccesses { get; set; } = new List<UserGymAccess>();
        public virtual ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
        public virtual ICollection<Department> Departments { get; set; } = new List<Department>();
        public virtual ICollection<Position> Positions { get; set; } = new List<Position>();
        public virtual ICollection<Team> Teams { get; set; } = new List<Team>();
    }
}

