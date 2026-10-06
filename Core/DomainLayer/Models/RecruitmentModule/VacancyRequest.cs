using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.RecruitmentModule
{
    /// <summary>
    /// Represents an internal requisition opened by a Branch Manager requesting headcount for a position at their gym.
    /// Reviewed by HR; once approved, HR creates a real public Vacancy linked to this request.
    /// </summary>
    public class VacancyRequest : BaseEntity
    {
        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public int PositionId { get; set; }
        public virtual Position Position { get; set; } = null!;

        public int RequestedBy { get; set; }
        public virtual User Requester { get; set; } = null!;

        public string Justification { get; set; } = string.Empty;
        public VacancyRequestStatus Status { get; set; } = VacancyRequestStatus.Pending;

        public int? DecidedBy { get; set; }
        public virtual User? Decider { get; set; }

        public DateTime? DecidedAt { get; set; }
        public string? DecisionComment { get; set; }

        public int? ResultingVacancyId { get; set; }
        public virtual Vacancy? ResultingVacancy { get; set; }
    }
}
