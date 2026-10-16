using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Auth;

/// <summary>Credentials for POST /api/auth/login.</summary>
public sealed class LoginRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; init; } = string.Empty;

    [Required, StringLength(256, MinimumLength = 1)]
    public string Password { get; init; } = string.Empty;
}
