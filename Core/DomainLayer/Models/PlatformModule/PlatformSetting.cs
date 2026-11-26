namespace DomainLayer.Models.PlatformModule
{
    /// <summary>
    /// Key/value platform configuration (security policy, localization, branding, billing
    /// defaults). Every change is written to the audit trail as a Settings event.
    /// </summary>
    public class PlatformSetting : BaseEntity<int>
    {
        /// <summary>Dotted key, e.g. "security.passwordRotationDays". Unique.</summary>
        public string Key { get; set; } = string.Empty;

        /// <summary>String form of the value; callers parse to the expected type.</summary>
        public string Value { get; set; } = string.Empty;

        public int? UpdatedByUserId { get; set; }

        /// <summary>
        /// When the value was last written. Declared explicitly so the settings screen can show
        /// it without an EF shadow-property lookup; the context still stamps it on save.
        /// </summary>
        public DateTime? UpdatedAt { get; set; }
    }
}
