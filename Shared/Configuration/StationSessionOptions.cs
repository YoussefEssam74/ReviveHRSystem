namespace Shared.Configuration
{
    /// <summary>Station session settings bound from the "StationSession" configuration section.</summary>
    public sealed class StationSessionOptions
    {
        public const string SectionName = "StationSession";

        /// <summary>Header carrying the station session token (used by API clients and tests).</summary>
        public const string SessionHeaderName = "X-Station-Token";

        /// <summary>HttpOnly cookie carrying the station session token (used by the kiosk SPA).</summary>
        public const string SessionCookieName = "StationSession";

        /// <summary>
        /// How long a kiosk session (issued when an enrollment code is redeemed)
        /// stays valid, in hours — 720 (30 days) by default, so a station survives
        /// machine reboots and power-offs without re-enrolling. Sessions can also be
        /// revoked early by HR; an expired session simply requires re-enrollment.
        /// </summary>
        public int LifetimeHours { get; set; } = 720;
    }
}
