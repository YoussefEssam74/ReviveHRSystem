using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Presentation.Controllers
{
    /// <summary>
    /// Employee profiles (mock §2 My Profile). The read returns the self-service
    /// profile shape (fullName, photoUrl, gym, emergency contact, …) instead of the
    /// HR directory's detail contract. These writes are actor-based: every caller
    /// updates HIS OWN contact/emergency-contact record — the id in the route is
    /// advisory (matrix row 22 semantics), so a manager session updates the manager's
    /// own record too and a cross-tenant caller can never write another gym's
    /// employee. Top Management (no employee profile) surfaces 401, which the matrix
    /// honestly records.
    /// </summary>
    [Route("api/employees")]
    public class EmployeesProfileController(
        IEmployeeProfileService employeeProfileService) : ApiControllerBase
    {
        /// <summary>
        /// GET /api/employees/{id}/profile — the profile contract the portal renders
        /// (including photoUrl). Self reads are always allowed; another employee's
        /// profile follows the same employee scope rules as the directory detail.
        /// </summary>
        [HttpGet("{id:int}/profile")]
        public async Task<ActionResult<EmployeeProfileDto>> GetProfile(int id, CancellationToken cancellationToken)
        {
            var profile = await employeeProfileService.GetProfileAsync(
                GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(profile);
        }

        /// <summary>Updates the caller's own contact fields (phone, address).</summary>
        [HttpPut("{id}/contact")]
        public async Task<ActionResult<EmployeeProfileDto>> UpdateContact(
            int id, UpdateContactRequestDto request, CancellationToken cancellationToken)
        {
            var profile = await employeeProfileService.UpdateContactAsync(GetActorUserId(), request, cancellationToken);
            return Ok(profile);
        }

        /// <summary>Updates the caller's own emergency contact.</summary>
        [HttpPatch("{id}/emergency-contact")]
        public async Task<ActionResult<EmployeeProfileDto>> UpdateEmergencyContact(
            int id, UpdateEmergencyContactRequestDto request, CancellationToken cancellationToken)
        {
            var profile = await employeeProfileService.UpdateEmergencyContactAsync(GetActorUserId(), request, cancellationToken);
            return Ok(profile);
        }
    }
}
