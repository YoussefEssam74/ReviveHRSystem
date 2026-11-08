using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Presentation.Controllers
{
    /// <summary>
    /// HR-editable attendance policy of one gym. The only setting for now is the monthly
    /// cap of excused Late Attendance / Early Leave hours — HR decides the number once
    /// and it is static for every employee of the gym. The route gym must be the active
    /// gym of the token and the caller must be a policy manager (Branch Manager or an
    /// HR role — see GymAttendancePolicyService).
    /// </summary>
    [Route("api/gyms/{gymId}/attendance-policy")]
    public class GymAttendancePolicyController(
        IGymAttendancePolicyService policyService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<AttendancePolicyDto>> Get(int gymId, CancellationToken cancellationToken)
        {
            EnsureGymScope(gymId);
            var policy = await policyService.GetAsync(GetActorUserId(), gymId, GetGymIdFromToken(), cancellationToken);
            return Ok(policy);
        }

        [HttpPut]
        public async Task<ActionResult<AttendancePolicyDto>> Update(
            int gymId, UpdateAttendancePolicyDto update, CancellationToken cancellationToken)
        {
            EnsureGymScope(gymId);
            var policy = await policyService.UpdateAsync(GetActorUserId(), gymId, update, GetGymIdFromToken(), cancellationToken);
            return Ok(policy);
        }
    }
}
