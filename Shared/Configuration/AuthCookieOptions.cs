namespace Shared.Configuration;

/// <summary>Cookie names shared by the web host and presentation controllers.</summary>
public static class AuthCookieOptions
{
    public const string AccessTokenCookie = "ReviveAccess";
    public const string RefreshTokenCookie = "ReviveRefresh";
    public const string ConsoleAccessTokenCookie = "ReviveConsoleAccess";
    public const string ConsoleRefreshTokenCookie = "ReviveConsoleRefresh";
    public const string CsrfHeader = "X-CSRF-TOKEN";
}
