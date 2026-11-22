using Shared.ErrorModels;

namespace ReviveHRSystem.Web.Middleware
{
    /// <summary>
    /// Refuses to let an impersonation (act-as) token reach platform administration.
    ///
    /// This is the single most important guard in the Super Admin console. A Super Admin
    /// entering a workspace receives a token whose <c>userType</c> is still
    /// <c>TopManagement</c> — deliberately, so nothing mistakes them for the role they are
    /// acting as. Without this check, that token would also satisfy every
    /// <c>platform.*</c> permission check, and "enter a gym workspace" would become a way to
    /// launder privilege: act-as on a company, then call the platform API with the workspace
    /// token and no console session.
    ///
    /// The rule lives here rather than in each controller because a per-endpoint check is
    /// exactly the kind of thing a future endpoint silently forgets. Adding a
    /// <c>/api/platform/**</c> route is therefore protected by default.
    ///
    /// Two endpoints are exempt, and only these: <c>impersonation/current</c> (the client must
    /// be able to ask whether its session is still open) and <c>impersonation/end</c> (the
    /// session must be able to close itself).
    /// </summary>
    public sealed class ImpersonationGuardMiddleware(RequestDelegate next, ILogger<ImpersonationGuardMiddleware> logger)
    {
        private const string PlatformPrefix = "/api/platform/";

        /// <summary>
        /// Paths an act-as token may still call. Everything else under /api/platform is refused.
        /// </summary>
        private static readonly string[] AllowedForActingTokens =
        [
            "/api/platform/impersonation/current",
            "/api/platform/impersonation/end",
        ];

        public async Task InvokeAsync(HttpContext context)
        {
            var path = context.Request.Path.Value ?? string.Empty;

            if (!path.StartsWith(PlatformPrefix, StringComparison.OrdinalIgnoreCase)
                || !IsActingToken(context)
                || IsAllowedForActingTokens(path))
            {
                await next(context);
                return;
            }

            var actorId = context.User.FindFirst("uid")?.Value;
            var sessionId = context.User.FindFirst("actSessionId")?.Value;

            logger.LogWarning(
                "Blocked act-as session {SessionId} (actor {ActorId}) from calling {Method} {Path}: "
                + "an impersonation token may not reach platform administration.",
                sessionId,
                actorId,
                context.Request.Method,
                path);

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";

            await context.Response.WriteAsJsonAsync(new ErrorToReturn
            {
                StatusCode = StatusCodes.Status403Forbidden,
                ErrorMessage = "An impersonation session cannot access platform administration. "
                               + "End the workspace session and return to the console.",
                Errors = [],
            });
        }

        private static bool IsActingToken(HttpContext context) =>
            context.User.Identity?.IsAuthenticated == true
            && string.Equals(context.User.FindFirst("act")?.Value, "true", StringComparison.OrdinalIgnoreCase);

        private static bool IsAllowedForActingTokens(string path) =>
            AllowedForActingTokens.Any(allowed =>
                path.Equals(allowed, StringComparison.OrdinalIgnoreCase)
                || path.Equals(allowed + "/", StringComparison.OrdinalIgnoreCase));
    }
}
