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

        /// <summary>
        /// Anti-spoof "real" score needed before a live scan is accepted for
        /// attendance. Kept in step with AttendanceService's minimum (0.70) - that
        /// one still guards caller-supplied scores on the /events endpoint, while
        /// this gate runs in the face pipeline so a low-score frame reports a
        /// measured "low liveness" outcome instead of dying later in the events
        /// pipeline with no number attached.
        /// </summary>
        public double ScanLivenessThreshold { get; set; } = 0.70;
    }
}
