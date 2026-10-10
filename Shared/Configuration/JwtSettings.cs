namespace Shared.Configuration
{
    /// <summary>JWT settings bound from the "Jwt" configuration section.</summary>
    public class JwtSettings
    {
        public string Issuer { get; set; } = string.Empty;
        public string Audience { get; set; } = string.Empty;
        /// <summary>Symmetric signing key. Must come from configuration/secrets, never committed for production.</summary>
        public string Key { get; set; } = string.Empty;
        /// <summary>Access token lifetime in minutes (ADR-002: 15–30).</summary>
        public int AccessTokenMinutes { get; set; } = 30;
        /// <summary>Lifetime of the temporary gym-selection session token in minutes.</summary>
        public int SelectionTokenMinutes { get; set; } = 5;
    }
}
