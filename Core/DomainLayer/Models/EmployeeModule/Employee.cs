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
    public class Employee : BaseEntity
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        public int GymId { get; set; }
        public virtual Gym Gym { get; set; } = null!;

        public int PositionId { get; set; }
        public virtual Position Position { get; set; } = null!;

        public int? CandidateId { get; set; }
        public virtual Candidate? Candidate { get; set; }

        public string EmployeeNumber { get; set; } = string.Empty;
        public DateOnly HireDate { get; set; }
        public EmployeeStatus Status { get; set; } = EmployeeStatus.Active;

        public string ContractType { get; set; } = string.Empty;
        public DateOnly ContractStartDate { get; set; }
        public DateOnly? ContractEndDate { get; set; }

        public bool BiometricRegistered { get; set; } = false;
        public byte[]? FaceEncoding { get; set; }

        // Navigations
        public virtual ICollection<EmploymentHistory> EmploymentHistories { get; set; } = new List<EmploymentHistory>();
        public virtual ICollection<EmployeeDocument> Documents { get; set; } = new List<EmployeeDocument>();
        public virtual ICollection<Compensation> Compensations { get; set; } = new List<Compensation>();
        public virtual ICollection<LeaveBalance> LeaveBalances { get; set; } = new List<LeaveBalance>();
        public virtual ICollection<TeamLeader> TeamLeaders { get; set; } = new List<TeamLeader>();
        public virtual ICollection<TeamMember> TeamMembers { get; set; } = new List<TeamMember>();
    }
}
