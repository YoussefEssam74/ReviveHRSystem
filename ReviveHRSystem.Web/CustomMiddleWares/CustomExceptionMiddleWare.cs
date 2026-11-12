using System.Net;
using DomainLayer.Exceptions;
using Shared.ErrorModels;

namespace ReviveHRSystem.Web.CustomMiddleWares
{
    public class CustomExceptionMiddleWare
    {

        private readonly RequestDelegate _next;
        private readonly ILogger<CustomExceptionMiddleWare> _logger;

        public CustomExceptionMiddleWare(RequestDelegate next, ILogger<CustomExceptionMiddleWare> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next.Invoke(context);
                await HandleNotFoundEndPointAsync(context);
            }
            catch (OperationCanceledException ex) when (context.RequestAborted.IsCancellationRequested)
            {
                // The client walked away (page navigation, gym switch, an aborted
                // refetch). No response can reach it anymore — don't spam the
                // error log with these, they are not failures.
                _logger.LogDebug(ex, "Request {Method} {Path} was canceled by the client.", context.Request.Method, context.Request.Path);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, ex.Message);
                await HandeleExceptionAsync(context, ex);
            }
        }

        private static async Task HandeleExceptionAsync(HttpContext context, Exception ex)
        {
            var Response = new ErrorToReturn()
            {
                ErrorMessage = ex.Message,
            };
            //Set status code for the response
            context.Response.StatusCode = ex switch
            {
                NotFoundException => StatusCodes.Status404NotFound,
                UnAuthorizedException => StatusCodes.Status401Unauthorized,
                BadRequestException badRequestException => GetBadRequestErrors(badRequestException, Response),
                _ => StatusCodes.Status500InternalServerError
            };

            //Set Content type for the response
            context.Response.ContentType = "application/json";

            // A 401 from an UnAuthorizedException is an authentication failure, not a
            // permission message: emit the bearer challenge so the SPA recognises it
            // and runs its silent-refresh / sign-in flow instead of rendering a dead-end
            // error card. (Without this header a request that carried no user identity —
            // e.g. only a kiosk station cookie — looked like a permanent crash.)
            if (context.Response.StatusCode == StatusCodes.Status401Unauthorized
                && !context.Response.Headers.ContainsKey("WWW-Authenticate"))
            {
                context.Response.Headers.WWWAuthenticate = "Bearer";
            }

            // Ensure StatusCode is set in the response object
            Response.StatusCode = context.Response.StatusCode;

            if (context.Response.StatusCode == StatusCodes.Status500InternalServerError)
            {
                var env = context.RequestServices.GetService<Microsoft.Extensions.Hosting.IHostEnvironment>();
                if (env is not null && !env.IsDevelopment())
                {
                    Response.ErrorMessage = "An internal server error occurred. Please contact support.";
                }
            }

            //Return Object as Json
            await context.Response.WriteAsJsonAsync(Response);
        }

        private static int GetBadRequestErrors(BadRequestException badRequestException, ErrorToReturn response)
        {
            response.Errors = badRequestException.Errors;
            return StatusCodes.Status400BadRequest;
        }

        private static async Task HandleNotFoundEndPointAsync(HttpContext context)
        {
            if (context.Response.StatusCode == StatusCodes.Status404NotFound && !context.Response.HasStarted)
            {
                var ErrorToReturn = new ErrorToReturn()
                {
                    StatusCode = StatusCodes.Status404NotFound,
                    ErrorMessage = $"End Point {context.Request.Path} is Not Found"
                };
                await context.Response.WriteAsJsonAsync(ErrorToReturn);
            }
        }
    }
}
