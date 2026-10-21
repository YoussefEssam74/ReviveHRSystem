using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Presentation.Controllers
{
    /// <summary>
    /// Employee profiles (mock §2 My Profile). These writes are actor-based: every
    /// caller updates HIS OWN contact/emergency-contact record — the id in the route
    /// is advisory (matrix row 22 semantics), so a manager session updates the
    /// manager's own record too and a cross-tenant caller can never write another
    /// gym's employee. Top Management (no employee profile) surfaces 401, which the
    /// matrix honestly records. The profile read itself is the HR directory's
    /// GET /api/employees/{id} ({ data } envelope); this surface owns the self-service writes.
    /// </summary>
    [Route("api/employees")]
    public class EmployeesProfileController(
        IEmployeeProfileService employeeProfileService) : ApiControllerBase
    {
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
