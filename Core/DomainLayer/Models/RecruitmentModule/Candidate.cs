namespace DomainLayer.Models.RecruitmentModule
{
    /// <summary>
    /// Represents an applicant who applied for a job.
    /// Stores contact info, national ID, CV file path, flexible JSONB education/experience/skills, and optional face biometric encoding.
    /// A candidate is distinct from an Employee until they are officially Hired.
    /// </summary>
    public class Candidate : BaseEntity<int>
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public DateOnly DateOfBirth { get; set; }
        public string NationalId { get; set; } = string.Empty;
        public string? CVFilePath { get; set; }

        // Flexible JSONB columns
        public string? EducationJson { get; set; }
        public string? ExperienceJson { get; set; }
        public string? SkillsJson { get; set; }

        // Optional biometric template for kiosk matching
        public byte[]? FaceEncoding { get; set; }

        public virtual ICollection<Application> Applications { get; set; } = new List<Application>();
    }
}

