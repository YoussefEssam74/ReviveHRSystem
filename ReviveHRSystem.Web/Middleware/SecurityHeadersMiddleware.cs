namespace ReviveHRSystem.Web.Middleware
{
    /// <summary>
    /// Baseline security headers for the API. In production these may also be set by
    /// the reverse proxy; setting them here guarantees they exist regardless.
    /// </summary>
    public class SecurityHeadersMiddleware
    {
        private readonly RequestDelegate _next;

        public SecurityHeadersMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers["X-Content-Type-Options"] = "nosniff";
                headers["X-Frame-Options"] = "DENY";
                headers["Referrer-Policy"] = "no-referrer";

                // Swagger UI (dev-only) must load its own scripts, styles and the
                // swagger.json definition; default-src 'none' would block all of it
                // and render an empty page. API responses keep the strict policy.
                if (!context.Request.Path.StartsWithSegments("/swagger"))
                {
                    headers["Content-Security-Policy"] = "default-src 'none'";
                }

                return Task.CompletedTask;
            });

            await _next(context);
        }
    }
}
