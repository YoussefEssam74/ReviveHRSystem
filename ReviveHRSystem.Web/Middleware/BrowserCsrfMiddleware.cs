using Microsoft.AspNetCore.Antiforgery;
using Shared.Configuration;

namespace ReviveHRSystem.Web.Middleware;

/// <summary>Validates ASP.NET antiforgery tokens on browser-originated unsafe requests.</summary>
public sealed class BrowserCsrfMiddleware(RequestDelegate next, ILogger<BrowserCsrfMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery)
    {
        var method = context.Request.Method;
        var unsafeMethod = method is not ("GET" or "HEAD" or "OPTIONS" or "TRACE");
        var hasBrowserOrigin = context.Request.Headers.ContainsKey("Origin");
        var hasCookieSession = context.Request.Cookies.ContainsKey(AuthCookieOptions.AccessTokenCookie)
            || context.Request.Cookies.ContainsKey(AuthCookieOptions.RefreshTokenCookie)
            || context.Request.Cookies.ContainsKey(Shared.Configuration.StationSessionOptions.SessionCookieName);

        if (unsafeMethod && (hasBrowserOrigin || hasCookieSession))
        {
            try
            {
                if (!await antiforgery.IsRequestValidAsync(context))
                {
                    logger.LogWarning("Rejected browser request without a valid antiforgery token: {Method} {Path}", method, context.Request.Path);
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        statusCode = 400,
                        errorMessage = "The request verification token is missing or invalid. Refresh and try again.",
                        errors = Array.Empty<object>(),
                        error = "CSRF_VALIDATION_FAILED"
                    }, context.RequestAborted);
                    return;
                }
            }
            catch (AntiforgeryValidationException)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsJsonAsync(new
                {
                    statusCode = 400,
                    errorMessage = "The request verification token is missing or invalid. Refresh and try again.",
                    errors = Array.Empty<object>(),
                    error = "CSRF_VALIDATION_FAILED"
                }, context.RequestAborted);
                return;
            }
        }

        await next(context);
    }
}
