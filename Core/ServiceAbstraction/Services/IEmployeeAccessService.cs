using DomainLayer.Models.UserModule.Enums;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Answers "may this user touch this employee's data, at what level, in this gym?"
    /// for every employee-scoped endpoint (ADR-003 Amendment 1). Self access is always
    /// granted at Edit level; access to others requires the matching feature level in
    /// the active gym, and the resolved scope (team vs gym) filters who "others" means.
    /// Cross-scope answers are indistinguishable from "not found" so the API never
    /// leaks the existence of other gyms' employees.
    /// </summary>
    public interface IEmployeeAccessService
    {
        /// <summary>The employee id of the acting user (his own profile), or null.</summary>
        Task<int?> GetOwnEmployeeIdAsync(int actorUserId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Throws <see cref="DomainLayer.Exceptions.NotFoundException"/> when the actor
        /// may not read the employee at the required level in the active gym; otherwise
        /// returns the target employee id.
        /// </summary>
        Task<int> EnsureCanAccessAsync(
            int actorUserId, int employeeId, string feature, AccessLevel requiredLevel,
            int? activeGymId, CancellationToken cancellationToken = default);
    }
}
