namespace ServiceAbstraction.Services
{
    /// <summary>
    /// The single place that maps a stored file's extension onto the media type it is
    /// served as. Shared by the storage provider (which stamps the type at write time)
    /// and by anything that has to derive it later from a persisted path — keeping them
    /// apart is how a file ends up stored as one type and downloaded as another.
    /// </summary>
    public static class FileContentTypes
    {
        /// <summary>
        /// Extension whitelist rather than a blocklist: an unknown extension is refused
        /// instead of trusted, so nothing can be stored under a name the server would
        /// then have to serve as an arbitrary type.
        /// </summary>
        private static readonly IReadOnlyDictionary<string, string> ByExtension =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                [".pdf"] = "application/pdf",
                [".png"] = "image/png",
                [".jpg"] = "image/jpeg",
                [".jpeg"] = "image/jpeg",
                [".webp"] = "image/webp",
                [".gif"] = "image/gif"
            };

        public static bool IsSupported(string? fileName) =>
            ByExtension.ContainsKey(ExtensionOf(fileName));

        public static string FromFileName(string? fileName) =>
            ByExtension.TryGetValue(ExtensionOf(fileName), out var contentType)
                ? contentType
                : "application/octet-stream";

        public static string ExtensionOf(string? fileName)
        {
            var name = Path.GetFileName(fileName ?? string.Empty).Trim();
            return Path.GetExtension(name).ToLowerInvariant();
        }
    }
}
