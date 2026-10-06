using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>
    /// Represents an active or historical staff member employed by Revive Solutions Fitness.
    /// Anchored to a primary gym and position, linked 1-to-1 with a User login account, and stores contract details and face biometrics.
    /// Branch Manager and Team Leader are roles assigned to an Employee, not distinct user types.
    /// </summary>
    public class Employee : BaseEntity<int>
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public int? TeamId { get; set; }
        public virtual Team? Team { get; set; }

        public int PositionId { get; set; }
        public virtual Position Position { get; set; } = null!;

        public int? CandidateId { get; set; }
        public virtual Candidate? Candidate { get; set; }

        public string FullName { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public string? NationalId { get; set; }
        public string? Address { get; set; }
        public string? EmergencyContactName { get; set; }
        public string? EmergencyContactRelationship { get; set; }
        public string? EmergencyContactPhone { get; set; }

        public string EmployeeNumber { get; set; } = string.Empty;
        public DateOnly HireDate { get; set; }
        public EmployeeStatus Status { get; set; } = EmployeeStatus.Active;

        public string ContractType { get; set; } = string.Empty;
        public DateOnly ContractStartDate { get; set; }
        public DateOnly? ContractEndDate { get; set; }

        public bool BiometricRegistered { get; set; } = false;
        public byte[]? FaceEncoding { get; set; }

        public int? OnboardingCompletedBy { get; set; }
        public DateTime? OnboardingCompletedAt { get; set; }
        public virtual User? OnboardingCompletedByUser { get; set; }

        // Navigations
        public virtual ICollection<EmploymentHistory> EmploymentHistories { get; set; } = new List<EmploymentHistory>();
        public virtual ICollection<EmployeeDocument> Documents { get; set; } = new List<EmployeeDocument>();
        public virtual ICollection<Compensation> Compensations { get; set; } = new List<Compensation>();
        public virtual ICollection<LeaveBalance> LeaveBalances { get; set; } = new List<LeaveBalance>();
        public virtual ICollection<TeamLeader> TeamLeaders { get; set; } = new List<TeamLeader>();
        public virtual ICollection<OnboardingChecklistItem> OnboardingChecklistItems { get; set; } = new List<OnboardingChecklistItem>();
        public virtual ICollection<OffboardingCase> OffboardingCases { get; set; } = new List<OffboardingCase>();
    }
}

