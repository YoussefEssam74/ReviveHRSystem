namespace Biometrics
{
    /// <summary>Face biometrics configuration (bound from the "Biometrics" section).</summary>
    public sealed class BiometricsOptions
    {
        public const string SectionName = "Biometrics";

        /// <summary>Max simultaneous inferences; frames queue beyond this (CPU protection).</summary>
        public int MaxConcurrentScans { get; set; } = 2;

        /// <summary>Cosine similarity needed to accept a face match (same as the reference service).</summary>
        public double MatchThreshold { get; set; } = 0.50;

        /// <summary>Anti-spoof "real" score needed to accept a face as live.</summary>
        public double LivenessThreshold { get; set; } = 0.60;
    }
}
