namespace DomainLayer.Models.EvaluationModule
{
    /// <summary>
    /// A performance review cycle window ("Q3 2026", "Mid-Year Review 2026") shown as
    /// chips on the evaluations page and seeded by the launch-cycle action
    /// (api-spec-from-ui.md §5.4).
    /// </summary>
    public class PerformanceCycle : BaseEntity<int>
    {
        public string Name { get; set; } = string.Empty;
        public DateOnly StartDate { get; set; }
        public DateOnly EndDate { get; set; }

        /// <summary>"Upcoming" | "In Progress" | "Completed".</summary>
        public string Status { get; set; } = "Upcoming";
    }
}
