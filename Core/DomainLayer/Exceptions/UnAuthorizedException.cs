namespace DomainLayer.Exceptions;

/// <summary>
/// Thrown when the caller is not authenticated or is not allowed to perform the
/// operation. Mapped to HTTP 401.
/// </summary>
public class UnAuthorizedException(string message) : Exception(message);
