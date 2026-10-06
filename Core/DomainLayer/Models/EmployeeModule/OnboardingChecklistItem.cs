using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>One onboarding requirement tracked for an employee.</summary>
    public class OnboardingChecklistItem : BaseEntity<int>
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public string Title { get; set; } = string.Empty;
        public int SortOrder { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }
        public int? CompletedBy { get; set; }
        public virtual User? CompletedByUser { get; set; }
        public string? Notes { get; set; }
    }
}

