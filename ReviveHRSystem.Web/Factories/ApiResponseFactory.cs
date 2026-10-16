using Microsoft.AspNetCore.Mvc;
using Shared.ErrorModels;

namespace ReviveHRSystem.Web.Factories
{
    public static class ApiResponseFactory
    {
        public static IActionResult GenerateApiValidationErrorResponse(ActionContext context)
        {
            var errors = context.ModelState
                .Where(m => m.Value?.Errors.Count > 0)
                .Select(m => new ValidationError
                {
                    Field = m.Key,
                    Errors = m.Value!.Errors.Select(e => e.ErrorMessage),
                })
                .ToArray();

            return new BadRequestObjectResult(new ValidationErrorToReturn
            {
                ValidationErrors = errors,
            });
        }
    }
}
