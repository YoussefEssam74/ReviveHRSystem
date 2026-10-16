namespace Storage
{
    /// <summary>
    /// Local-disk storage settings, bound from the "Storage" section. Nothing here is
    /// a secret: the root is a plain directory, the caps are defence in depth.
    /// </summary>
    public sealed class StorageOptions
    {
        public const string SectionName = "Storage";

        /// <summary>
        /// Where files live. A relative value is resolved against the host's base
        /// directory, so a deployment can point it at a mounted volume without code
        /// changes and leave the default out of source control.
        /// </summary>
        public string RootPath { get; set; } = "App_Data/storage";

        /// <summary>Hard ceiling on one upload; larger bodies are refused mid-write.</summary>
        public long MaxUploadBytes { get; set; } = 10 * 1024 * 1024;
    }
}
