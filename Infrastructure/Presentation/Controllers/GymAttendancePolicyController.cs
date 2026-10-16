using Microsoft.AspNetCore.Mvc;
using Presentation.Authorization;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;
using DomainLayer.Models.UserModule.Enums;

namespace Presentation.Controllers
{
    /// <summary>
    /// HR-editable attendance policy of one gym. The only setting for now is the monthly
    /// cap of excused Late Attendance / Early Leave hours — HR decides the number once
    /// and it is static for every employee of the gym. Gated by the `attendance` feature;
    /// the route gym must be the active gym of the token.
    /// </summary>
    [Route("api/gyms/{gymId}/attendance-policy")]
    public class GymAttendancePolicyController(
        IGymAttendancePolicyService policyService) : ApiControllerBase
    {
        [HttpGet]
        [HasFeatureAccess(Features.Attendance, AccessLevel.View)]
        public async Task<ActionResult<AttendancePolicyDto>> Get(int gymId, CancellationToken cancellationToken)
        {
            EnsureGymScope(gymId);
            var policy = await policyService.GetAsync(GetActorUserId(), gymId, GetGymIdFromToken(), cancellationToken);
            return Ok(policy);
        }

        [HttpPut]
        [HasFeatureAccess(Features.Attendance, AccessLevel.Edit)]
        public async Task<ActionResult<AttendancePolicyDto>> Update(
            int gymId, UpdateAttendancePolicyDto update, CancellationToken cancellationToken)
        {
            EnsureGymScope(gymId);
            var policy = await policyService.UpdateAsync(GetActorUserId(), gymId, update, GetGymIdFromToken(), cancellationToken);
            return Ok(policy);
        }
    }
}
