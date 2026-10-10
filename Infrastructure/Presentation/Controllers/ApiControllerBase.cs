using System.Security.Claims;
using DomainLayer.Exceptions;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public abstract class ApiControllerBase : ControllerBase
    {
        /// <summary>Claim type that marks the identity of a validated station session.</summary>
        private const string StationPurposeClaim = "purpose";
        private const string StationPurposeValue = "station";

        /// <summary>
        /// Gym binding of the caller: the gym of the validated station session when one
        /// is present (a kiosk browser may also carry a stale web-session token, and the
        /// session is authoritative), otherwise the gym-scoped user token's gymId claim.
        /// Null when nothing gym-bound is presented.
        /// </summary>
        protected int? GetGymIdFromToken()
        {
            var raw = User.Identities
                .OrderByDescending(identity => identity.HasClaim(StationPurposeClaim, StationPurposeValue))
                .Select(identity => identity.FindFirst("gymId")?.Value)
                .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
            return int.TryParse(raw, out var gymId) ? gymId : null;
        }

        /// <summary>
        /// Id of the validated station session that issued the request, or null when the
        /// caller authenticated with a user token instead of a station session.
        /// </summary>
        protected int? GetStationSessionId()
        {
            var raw = User.Identities
                .FirstOrDefault(identity => identity.HasClaim(StationPurposeClaim, StationPurposeValue))
                ?.FindFirst("sid")?.Value;
            return int.TryParse(raw, out var sessionId) ? sessionId : null;
        }

        /// <summary>
        /// Numeric id of the acting user, from the token's uid claim. Station sessions
        /// carry no uid (their gym binding lives in the session), so they are rejected
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
