using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.User;

namespace Presentation.Controllers
{
    /// <summary>
    /// User-level assignment endpoints (S2, user detail 6.4–6.6): direct
    /// permission replacement, single-role assignment (by id or preset name),
    /// and gym-access replacement (by ids or names). The full user CRUD belongs
    /// to a later section; only the assignment PUTs exist here. team.manage.
    /// </summary>
    [Route("api/users")]
    [Authorize]
    public class UsersController(IRoleService _service) : ApiControllerBase
    {
        /// <summary>GET /api/users/{id} — access profile for My Access (own id, or admin with team.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<UserAccessProfileResponse>> GetUserAccessProfile(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetUserAccessProfileAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/users/{id}/permissions — replaces direct permissions wholesale (6.4).</summary>
        [HttpPut("{id:int}/permissions")]
        public async Task<ActionResult<UserAssignmentResponse>> ReplacePermissions(int id, [FromBody] UserPermissionsRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ReplaceUserPermissionsAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/users/{id}/roles — assigns a role by id/preset name, or clears with both null (6.5).</summary>
        [HttpPut("{id:int}/roles")]
        public async Task<ActionResult<UserAssignmentResponse>> ReplaceRoles(int id, [FromBody] UserRoleAssignmentRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ReplaceUserRolesAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/users/{id}/gym-access — replaces gym access by ids/names; empty revokes all (6.6).</summary>
        [HttpPut("{id:int}/gym-access")]
        public async Task<ActionResult<UserAssignmentResponse>> ReplaceGymAccess(int id, [FromBody] UserGymAccessRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ReplaceUserGymAccessAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }
    }
}
