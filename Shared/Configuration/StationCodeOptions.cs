namespace Shared.Configuration
{
    /// <summary>Station enrollment-code settings bound from the "StationCode" configuration section.</summary>
    public sealed class StationCodeOptions
    {
        public const string SectionName = "StationCode";

        /// <summary>
        /// How long an HR-generated 6-digit enrollment code stays valid, in minutes.
        /// A short window keeps the brute-force surface small (the endpoint is
        /// anonymous and rate limited per IP). Rotated codes are also invalidated
        /// immediately, so this only bounds a code nobody redeemed yet.
        /// </summary>
        public int ExpirationMinutes { get; set; } = 5;
    }
}
