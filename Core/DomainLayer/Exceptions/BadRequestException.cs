namespace DomainLayer.Exceptions;

/// <summary>
/// Thrown when the request is invalid. Mapped to HTTP 400.
/// </summary>
public class BadRequestException : Exception
{
    /// <summary>Per-field validation errors, if any.</summary>
    public List<string> Errors { get; }

    public BadRequestException(string message, List<string>? errors = null, Exception? innerException = null)
        : base(message, innerException)
    {
        Errors = errors ?? new List<string>();
    }
}
