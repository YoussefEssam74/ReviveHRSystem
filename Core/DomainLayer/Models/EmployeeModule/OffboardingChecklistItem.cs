using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>One exit task tracked for an employee separation.</summary>
    public class OffboardingChecklistItem : BaseEntity<int>
    {
        public int OffboardingCaseId { get; set; }
        public virtual OffboardingCase OffboardingCase { get; set; } = null!;

        public string Title { get; set; } = string.Empty;
        public int SortOrder { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }
        public int? CompletedBy { get; set; }
        public virtual User? CompletedByUser { get; set; }
        public string? Notes { get; set; }
    }
}

