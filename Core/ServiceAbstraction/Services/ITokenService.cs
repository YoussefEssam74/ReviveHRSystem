using DomainLayer.Models.UserModule;

namespace ServiceAbstraction.Services
{
    /// <summary>Issues and validates the JWT tokens used by the web login flow.</summary>
    public interface ITokenService
    {
        /// <summary>Creates the short-lived access token (ADR-002 claims: userId, userType, email; scoped to one gym for employees).</summary>
        string CreateAccessToken(User user, IEnumerable<string> permissionKeys, int? scopedGymId);

        /// <summary>Creates the short-lived temp session token used between login and gym selection.</summary>
        string CreateGymSelectionToken(int userId);

        /// <summary>Validates a temp session token and returns its userId, or null when invalid/expired.</summary>
        int? ValidateGymSelectionToken(string token);

        /// <summary>Access token lifetime in seconds (for the login response).</summary>
        int AccessTokenExpiresInSeconds { get; }
    }
}
