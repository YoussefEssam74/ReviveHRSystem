namespace Shared.Configuration
{
    /// <summary>
    /// Brute-force account lockout knobs, bound from the "Security" configuration
    /// section. After <see cref="MaxFailedLogins"/> consecutive failed sign-in
    /// attempts the account refuses every login (even the correct password) for
    /// <see cref="LockoutWindowMinutes"/>; a successful login resets the counter.
    /// </summary>
    public class SecurityLockoutOptions
    {
        public const string SectionName = "Security";

        /// <summary>Failed logins that trip the lock. Default 5 (matrix rate-limit spec).</summary>
        public int MaxFailedLogins { get; set; } = 5;

        /// <summary>How long the lock stays up, in minutes. Default 15.</summary>
        public int LockoutWindowMinutes { get; set; } = 15;
    }
}
