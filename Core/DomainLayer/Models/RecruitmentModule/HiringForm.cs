using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.RecruitmentModule
{
    /// <summary>
    /// A dynamic application ("hiring") form built in the Form Builder and published
    /// to the anonymous careers/apply page (api-spec-from-ui.md §5.2/§5.3).
    /// Questions are stored as a JSON array ([{ type: "text"|"checkbox"|"choose", text, options[] }])
    /// because only the form-builder editor and the public renderer ever touch them.
    /// </summary>
    public class HiringForm : BaseEntity<int>
    {
        public int? GymId { get; set; }
        public virtual Gym? Gym { get; set; }

        public string Name { get; set; } = string.Empty;

        /// <summary>Target position title ("Trainer", "Receptionist", …); null/blank = any position.</summary>
        public string? Position { get; set; }

        /// <summary>
        /// Public job description shown on the careers page and above the application
        /// form — responsibilities, requirements, working hours. Null/blank = hidden.
        /// </summary>
        public string? Description { get; set; }

        /// <summary>"Open" (accepting submissions, listed publicly) | "Closed".</summary>
        public string Status { get; set; } = "Open";

        /// <summary>Optional reference document uploaded with the form (relative storage path).</summary>
        public string? AttachmentPath { get; set; }

        /// <summary>Original file name of <see cref="AttachmentPath"/>, shown in the builder.</summary>
        public string? AttachmentName { get; set; }

        /// <summary>JSON array of question blocks — see class summary.</summary>
        public string QuestionsJson { get; set; } = "[]";

        public int? CreatedBy { get; set; }
        public virtual User? Creator { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        /// <summary>When an application was last submitted through this form (card "last used").</summary>
        public DateTime? LastUsedAt { get; set; }
    }
}
