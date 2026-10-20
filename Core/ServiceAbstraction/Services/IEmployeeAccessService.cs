namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Answers "may this user touch this employee's data in this gym?" for every
    /// employee-scoped endpoint. Self access is always granted; access to others is
    /// resolved by scope (team vs gym), which filters who "others" means.
    /// Cross-scope answers are indistinguishable from "not found" so the API never
    /// leaks the existence of other gyms' employees.
    /// </summary>
    public interface IEmployeeAccessService
    {
        /// <summary>The employee id of the acting user (his own profile), or null.</summary>
        Task<int?> GetOwnEmployeeIdAsync(int actorUserId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Throws <see cref="DomainLayer.Exceptions.NotFoundException"/> when the actor
        /// may not access the employee in the active gym; otherwise returns the target
        /// employee id.
        /// </summary>
        Task<int> EnsureCanAccessAsync(
            int actorUserId, int employeeId,
            int? activeGymId, CancellationToken cancellationToken = default);
    }
}
