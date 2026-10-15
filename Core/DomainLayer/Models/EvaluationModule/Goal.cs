using DomainLayer.Models.EmployeeModule;

namespace DomainLayer.Models.EvaluationModule
{
    /// <summary>
    /// A goal / OKR tracked for an employee on the evaluations History &amp; Trends tab
    /// (api-spec-from-ui.md §5.4). Employee is optional because the UI's Add-goal form
    /// only captures a display name; EmployeeId is resolved when a unique match exists.
    /// </summary>
    public class Goal : BaseEntity<int>
    {
        public int? EmployeeId { get; set; }
        public virtual Employee? Employee { get; set; }

        /// <summary>Employee display name as entered (kept even when unresolved).</summary>
        public string EmployeeName { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;

        /// <summary>"On Track" | "At Risk" | "Behind".</summary>
        public string Status { get; set; } = "On Track";

        /// <summary>Completion 0–100 (%).</summary>
        public int Progress { get; set; }

        public DateOnly? DueDate { get; set; }

        /// <summary>Owner / manager display name.</summary>
        public string Owner { get; set; } = string.Empty;
    }
}
