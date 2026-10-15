using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule.Enums;

namespace DomainLayer.Models.RecruitmentModule
{
    /// <summary>
    /// Represents an open job opening published with a unique public link token for applicants.
    /// Tracks target headcount needed (e.g. 20 trainers) and links to candidate applications.
    /// </summary>
    public class Vacancy : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public int PositionId { get; set; }
        public virtual Position Position { get; set; } = null!;

        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Requirements { get; set; } = string.Empty;
        public int HeadcountNeeded { get; set; } = 1;
        public string PublicLinkToken { get; set; } = string.Empty;
        public VacancyStatus Status { get; set; } = VacancyStatus.Open;

        // ---- Fields the recruitment UI renders ("Low" | "Medium" | "High") ----
        public string? Urgency { get; set; }
        public decimal? Salary { get; set; }
        public string? Shift { get; set; }
        public string? Source { get; set; }
        /// <summary>User who opened the vacancy (HR, or the approving HR for a vacancy request).</summary>
        public int? RequestedBy { get; set; }

        /// <summary>When the vacancy was opened (the UI's "Created" column).</summary>
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public virtual ICollection<Application> Applications { get; set; } = new List<Application>();
    }
}

