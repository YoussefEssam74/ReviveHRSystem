using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Permission;

namespace Presentation.Controllers
{
    /// <summary>
    /// The permission catalog (S2, 6.7 + My Access matrix): every tracked
    /// permission key, served flat ({ key, area }) for the super-admin grid and
    /// area-grouped ({ name, permissions[] }) for the portal matrix. team.view.
    /// </summary>
    [Route("api/permissions")]
    [Authorize]
    public class PermissionsController(IRoleService _service) : ApiControllerBase
    {
        /// <summary>GET /api/permissions — flat items + area-grouped modules + totalTracked (team.view).</summary>
        [HttpGet]
        public async Task<ActionResult<PermissionCatalogResponse>> GetPermissions(CancellationToken cancellationToken)
        {
            var result = await _service.GetPermissionCatalogAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }
    }
}
