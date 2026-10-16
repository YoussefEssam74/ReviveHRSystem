using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Presentation.Controllers
{
    /// <summary>
    /// Employee profiles (mock §2 My Profile). Self reads/updates need only the JWT;
    /// access to another employee additionally requires the [employees] feature level
    /// in the active gym plus matching scope (team/gym), enforced in the service layer
    /// (ADR-003 Amendment 1). Employment and compensation fields stay HR-controlled.
    /// </summary>
    [Route("api/employees")]
    public class EmployeesProfileController(
        IEmployeeProfileService employeeProfileService,
        IEmployeeAccessService employeeAccessService) : ApiControllerBase
    {
        /// <summary>Returns the employee profile the caller may access.</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<EmployeeProfileDto>> GetProfile(int id, CancellationToken cancellationToken)
        {
            var actorUserId = GetActorUserId();
            var gymId = GetGymIdFromToken();
            var profile = await employeeProfileService.GetProfileAsync(actorUserId, id, gymId, cancellationToken);
            return Ok(profile);
        }

        /// <summary>Updates the caller's own contact fields (phone, address).</summary>
        [HttpPut("{id}/contact")]
        public async Task<ActionResult<EmployeeProfileDto>> UpdateContact(
            int id, UpdateContactRequestDto request, CancellationToken cancellationToken)
        {
            await RequireOwnEmployeeIdAsync(id, cancellationToken);
            var profile = await employeeProfileService.UpdateContactAsync(GetActorUserId(), request, cancellationToken);
            return Ok(profile);
        }

        /// <summary>Updates the caller's own emergency contact.</summary>
        [HttpPatch("{id}/emergency-contact")]
        public async Task<ActionResult<EmployeeProfileDto>> UpdateEmergencyContact(
            int id, UpdateEmergencyContactRequestDto request, CancellationToken cancellationToken)
        {
            await RequireOwnEmployeeIdAsync(id, cancellationToken);
            var profile = await employeeProfileService.UpdateEmergencyContactAsync(GetActorUserId(), request, cancellationToken);
            return Ok(profile);
        }

        /// <summary>Ensures the route id is the caller's own employee id (self-only writes).</summary>
        private async Task<int> RequireOwnEmployeeIdAsync(int routeId, CancellationToken cancellationToken)
        {
            var own = await employeeAccessService.GetOwnEmployeeIdAsync(GetActorUserId(), cancellationToken);
            if (own is null || own.Value != routeId)
            {
                // Unknown-to-the-caller id: answer identically to a missing profile.
                throw new DomainLayer.Exceptions.NotFoundException("Employee not found.");
            }

            return own.Value;
        }
    }
}
