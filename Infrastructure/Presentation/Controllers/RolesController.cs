using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Role;

namespace Presentation.Controllers
{
    /// <summary>
    /// Roles &amp; Permissions admin endpoints (S2, page-roles): paged roles list,
    /// create/update, Configure (permissions replacement), clone, and archive.
    /// Every action is JWT-authenticated; the team.view / team.manage guards run
    /// inside the service (ADR-003). Creates return 201 { data } per the UI spec;
    /// archive returns 204.
    /// </summary>
    [Route("api/roles")]
    [Authorize]
    public class RolesController(IRoleService _service) : ApiControllerBase
    {
        /// <summary>GET /api/roles — paged roles with permission/user counters (team.view).</summary>
        [HttpGet]
        public async Task<ActionResult<RolesListResponse>> GetRoles([FromQuery] RoleListQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetRolesAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/roles — creates a role, optionally cloning a permission set (team.manage) → 201 { data }.</summary>
        [HttpPost]
        public async Task<ActionResult<RoleDataResponse>> CreateRole([FromBody] CreateRoleRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateRoleAsync(GetActorUserId(), request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>PUT /api/roles/{id} — updates name/description and optionally permissions (team.manage).</summary>
        [HttpPut("{id:int}")]
        public async Task<ActionResult<RoleDataResponse>> UpdateRole(int id, [FromBody] UpdateRoleRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.UpdateRoleAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/roles/{id}/permissions — replaces the permission set wholesale (team.manage).</summary>
        [HttpPut("{id:int}/permissions")]
        public async Task<ActionResult<RolePermissionsResponse>> SetPermissions(int id, [FromBody] SetRolePermissionsRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.SetRolePermissionsAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/roles/{id}/clone — copies the source role's permissions under a new name (team.manage) → 201 { data }.</summary>
        [HttpPost("{id:int}/clone")]
        public async Task<ActionResult<RoleDataResponse>> CloneRole(int id, [FromBody] CloneRoleRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CloneRoleAsync(GetActorUserId(), id, request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>DELETE /api/roles/{id} — archives the role; assigned roles are rejected with 400 (team.manage).</summary>
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> ArchiveRole(int id, CancellationToken cancellationToken)
        {
            await _service.ArchiveRoleAsync(GetActorUserId(), id, cancellationToken);
            return NoContent();
        }
    }
}
