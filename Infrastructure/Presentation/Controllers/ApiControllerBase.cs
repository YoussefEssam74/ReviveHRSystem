using System.Security.Claims;
using DomainLayer.Exceptions;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public abstract class ApiControllerBase : ControllerBase
    {
        /// <summary>
        /// Gym binding from the token's gymId claim (present on gym-scoped user
        /// tokens and station tokens), or null when the token is not gym-bound.
        /// </summary>
        protected int? GetGymIdFromToken()
        {
            var raw = User.FindFirst("gymId")?.Value;
            return int.TryParse(raw, out var gymId) ? gymId : null;
        }

        /// <summary>
        /// Numeric id of the acting user, from the token's uid claim. Station tokens
        /// carry a non-numeric sub ("gym-{gymId}") and no uid, so they are rejected
        /// here rather than reaching an HR-only operation.
        /// </summary>
        protected int GetActorUserId()
        {
            var uidClaim = User.FindFirst("uid")?.Value ?? User.FindFirst("sub")?.Value;
            return int.TryParse(uidClaim, out int parsedUid)
                ? parsedUid
                : throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
        }
    }
}
