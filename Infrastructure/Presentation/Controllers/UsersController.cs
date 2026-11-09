using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Employee;
using Shared.DataTransferObject.User;

namespace Presentation.Controllers
{
    /// <summary>
    /// User-level assignment endpoints (S2, user detail 6.4–6.6): direct
    /// permission replacement, single-role assignment (by id or preset name),
    /// and gym-access replacement (by ids or names), plus the HR-Team wizard's
    /// account lifecycle — create (H3), suspend/reactivate (H6) and the admin
    /// password reset (D12). Writes are gated team.manage inside the service.
    /// </summary>
    [Route("api/users")]
    [Authorize]
    public class UsersController(IRoleService _service) : ApiControllerBase
    {
        /// <summary>GET /api/users — HR Team member list with role/gym/permission counters (team.view).</summary>
        [HttpGet]
        public async Task<ActionResult<UsersListResponse>> GetUsers([FromQuery] UserListQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetUsersAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/users — creates an HR account (identity + gyms + permissions + optional role; team.manage) → 201 { data }.</summary>
        [HttpPost]
        public async Task<ActionResult<CreateUserResponse>> CreateUser([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateUserAsync(GetActorUserId(), request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>GET /api/users/{id} — access profile for My Access (own id, or admin with team.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<UserAccessProfileResponse>> GetUserAccessProfile(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetUserAccessProfileAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/users/{id}/status — suspends/reactivates an account; reason required, self-suspend refused (H6, team.manage).</summary>
        [HttpPut("{id:int}/status")]
        public async Task<ActionResult<MessageResponse>> ChangeUserStatus(int id, [FromBody] UserStatusRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ChangeUserStatusAsync(GetActorUserId(), id, request, cancellationToken);
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

        /// <summary>POST /api/users/{id}/reset-password — admin sets a known new password; never echoed back (D12, team.manage).</summary>
        [HttpPost("{id:int}/reset-password")]
        public async Task<ActionResult<MessageResponse>> ResetUserPassword(int id, [FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ResetUserPasswordAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }
    }
}
