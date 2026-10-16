using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.OpenApi.Models;
using Shared.ErrorModels;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace ReviveHRSystem.Web.Swagger
{
    /// <summary>
    /// Single source of truth for documented error responses. Attaches the standard
    /// <see cref="ErrorToReturn"/> envelope for 400/401/404/500 to every
    /// operation, plus 429 only where the endpoint actually has [EnableRateLimiting].
    /// Actions therefore only declare their success response instead of repeating a
    /// copy-pasted stack of error attributes.
    /// </summary>
    public sealed class ErrorResponseOperationFilter : IOperationFilter
    {
        private static readonly int[] DefaultErrorStatuses =
        {
            StatusCodes.Status400BadRequest,
            StatusCodes.Status401Unauthorized,
            StatusCodes.Status404NotFound,
            StatusCodes.Status500InternalServerError
        };

        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            var statuses = new List<int>(DefaultErrorStatuses);

            var isRateLimited = context.ApiDescription.ActionDescriptor.EndpointMetadata?
                .OfType<EnableRateLimitingAttribute>().Any() == true;
            if (isRateLimited)
            {
                statuses.Add(StatusCodes.Status429TooManyRequests);
            }

            var errorSchema = context.SchemaGenerator.GenerateSchema(typeof(ErrorToReturn), context.SchemaRepository);

            foreach (var statusCode in statuses)
            {
                var key = statusCode.ToString();
                if (operation.Responses.ContainsKey(key))
                {
                    continue;
                }

                operation.Responses[key] = new OpenApiResponse
                {
                    Description = GetDescription(statusCode),
                    Content = new Dictionary<string, OpenApiMediaType>
                    {
                        ["application/json"] = new() { Schema = errorSchema }
                    }
                };
            }
        }

        private static string GetDescription(int statusCode) => statusCode switch
        {
            StatusCodes.Status400BadRequest => "Bad Request",
            StatusCodes.Status401Unauthorized => "Unauthorized",
            StatusCodes.Status404NotFound => "Not Found",
            StatusCodes.Status429TooManyRequests => "Too Many Requests",
            _ => "Internal Server Error"
        };
    }
}
