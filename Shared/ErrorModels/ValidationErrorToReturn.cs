using System.Net;

namespace Shared.ErrorModels
{
    public class ValidationErrorToReturn
    {
        public int statusCode { get; set; } = (int)HttpStatusCode.BadRequest;
        public string errorMessage { get; set; } = "Validation Error";
        public IEnumerable<ValidationError> ValidationErrors { get; set; } = [];
    }
}
