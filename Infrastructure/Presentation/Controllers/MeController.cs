using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Auth;

namespace Presentation.Controllers
{
    /// <summary>
    /// Session context for the authenticated user (ADR-002/ADR-003 amendments):
    /// identity, gym options, per-gym role, led team and the effective feature
    /// access levels of the active gym. The SPA gates navigation and actions on it.
    /// </summary>
    [Route("api/me")]
    public class MeController(ISessionContextService sessionContextService) : ApiControllerBase
    {
        /// <summary>
        /// Returns the caller's session context. Feature levels are resolved for the
        /// gym the access token is scoped to; a session without a gym scope (multi-gym
        /// account before the in-session switch) falls back to the caller's global keys.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<MeResponse>> GetMe(CancellationToken cancellationToken)
        {
            var userId = GetActorUserId();
            var gymId = GetGymIdFromToken();
            var response = await sessionContextService.GetMeAsync(userId, gymId, cancellationToken);
            return Ok(response);
        }
    }
}
