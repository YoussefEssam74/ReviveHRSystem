using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>Tracks an employee separation and its exit checklist.</summary>
    public class OffboardingCase : BaseEntity<int>
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public DateOnly LastWorkingDate { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = "Open";
        public int InitiatedBy { get; set; }
        public virtual User InitiatedByUser { get; set; } = null!;
        public DateTime InitiatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }
        public virtual ICollection<OffboardingChecklistItem> ChecklistItems { get; set; } = new List<OffboardingChecklistItem>();
    }
}

