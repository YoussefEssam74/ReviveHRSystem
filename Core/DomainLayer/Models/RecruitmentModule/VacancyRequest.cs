using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.RecruitmentModule
{
    /// <summary>
    /// Represents an internal requisition opened by a Branch Manager requesting headcount for a position at their gym.
    /// Reviewed by HR; once approved, HR creates a real public Vacancy linked to this request.
    /// </summary>
    public class VacancyRequest : BaseEntity<int>
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public int PositionId { get; set; }
        public virtual Position Position { get; set; } = null!;

        public int RequestedBy { get; set; }
        public virtual User Requester { get; set; } = null!;

        public string Justification { get; set; } = string.Empty;
        public VacancyRequestStatus Status { get; set; } = VacancyRequestStatus.Pending;

        // ---- Requisition details the request cards render ----
        public string? Urgency { get; set; }
        public decimal? Salary { get; set; }
        public string? Shift { get; set; }
        public int Headcount { get; set; } = 1;

        /// <summary>When the requisition was submitted (the UI's "Submitted" column).</summary>
        public DateTime SubmittedDate { get; set; } = DateTime.UtcNow;

        public int? DecidedBy { get; set; }
        public virtual User? Decider { get; set; }

        public DateTime? DecidedAt { get; set; }
        public string? DecisionComment { get; set; }

        public int? ResultingVacancyId { get; set; }
        public virtual Vacancy? ResultingVacancy { get; set; }
    }
}

