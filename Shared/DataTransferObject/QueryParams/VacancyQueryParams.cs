namespace Shared.DataTransferObject.QueryParams
{
    /// <summary>
    /// Vacancy request filters (mock §23). Vacancy requests are gym artifacts, so the
    /// list is always gym-scoped; team leaders see the gym's requests because the
    /// artifact belongs to the branch, not the team.
    /// </summary>
    public sealed class VacancyQueryParams : PaginationParams
    {
        /// <summary>Vacancy status (Submitted | Pending | Approved | Rejected).</summary>
        public string? Status { get; set; }
    }
}
