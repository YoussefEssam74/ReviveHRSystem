using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>Employee profile reads and the self-editable contact fields
    /// (mock §2 My Profile). Employment/compensation fields are HR-controlled and
    /// read-only for employees (roles guide §7).</summary>
    public interface IEmployeeProfileService
    {
        /// <summary>Profile of an employee the caller may access (self, or a
        /// [employees] grant in the active gym with matching scope).</summary>
        Task<EmployeeProfileDto> GetProfileAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>Updates the caller's own contact fields (phone, email, address).</summary>
        Task<EmployeeProfileDto> UpdateContactAsync(
            int actorUserId, UpdateContactRequestDto request, CancellationToken cancellationToken = default);

        /// <summary>Updates the caller's own emergency contact.</summary>
        Task<EmployeeProfileDto> UpdateEmergencyContactAsync(
            int actorUserId, UpdateEmergencyContactRequestDto request, CancellationToken cancellationToken = default);
    }
}
