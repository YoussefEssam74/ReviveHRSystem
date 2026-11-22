namespace DomainLayer.Models.PlatformModule.Enums
{
    /// <summary>How widely a feature flag applies. Targets live in FeatureFlagTarget.</summary>
    public enum FeatureFlagScope
    {
        Global = 1,
        Plans = 2,
        Companies = 3
    }
}
