using DomainLayer.Models.PlatformModule.Enums;

namespace DomainLayer.Models.PlatformModule
{
    /// <summary>
    /// A platform feature toggle. A Global flag needs no targets; a Plans or Companies flag
    /// applies only to the rows in <see cref="Targets"/>.
    /// </summary>
    public class FeatureFlag : BaseEntity<int>
    {
        /// <summary>Dotted key, e.g. "biometric.faceid.v2". Unique.</summary>
        public string Key { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }

        public bool IsEnabled { get; set; }
        public FeatureFlagScope Scope { get; set; } = FeatureFlagScope.Global;

        public int? UpdatedByUserId { get; set; }

        /// <summary>
        /// When the flag was last written. Declared explicitly so the console can show it without
        /// an EF shadow-property lookup; the context still stamps it on save.
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        public virtual ICollection<FeatureFlagTarget> Targets { get; set; } = new List<FeatureFlagTarget>();
    }
}
