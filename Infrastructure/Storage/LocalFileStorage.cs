using Microsoft.Extensions.Options;
using ServiceAbstraction.Services;

namespace Storage
{
    /// <summary>
    /// Files on the host's local disk, under one configured root.
    ///
    /// Two rules shape this class. First, the on-disk name is generated here — never
    /// taken from the request — so an upload can neither overwrite another file nor
    /// carry a name that escapes the directory it belongs to. Second, every read is
    /// re-checked against the root, because the stored path is data that outlives the
    /// request that wrote it (and older rows were populated from a client-supplied
    /// value), so it is treated as untrusted on the way back in.
    /// </summary>
    public sealed class LocalFileStorage(IOptions<StorageOptions> options) : IFileStorage
    {
        private static readonly HashSet<string> AllowedCategories = new(StringComparer.OrdinalIgnoreCase)
        {
            "avatars",
            "documents",
            "hr-documents",
            "request-attachments"
        };

        private readonly StorageOptions options = options.Value;

        private string RootPath
        {
            get
            {
                var configured = string.IsNullOrWhiteSpace(options.RootPath)
                    ? "App_Data/storage"
                    : options.RootPath;

                return Path.GetFullPath(Path.IsPathRooted(configured)
                    ? configured
                    : Path.Combine(AppContext.BaseDirectory, configured));
            }
        }

        public async Task<StoredFileInfo> SaveAsync(
            string category, string fileName, Stream content, CancellationToken cancellationToken = default)
        {
            if (!AllowedCategories.Contains(category))
            {
                // Category is chosen by callers, never by the request, so reaching here
                // is a programming error rather than bad user input.
                throw new ArgumentException($"Unknown storage category '{category}'.", nameof(category));
            }

            var extension = ExtensionFor(fileName);
            var relativePath = $"{category}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{extension}";

            var fullPath = ResolveWithinRoot(relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

            var maxBytes = options.MaxUploadBytes > 0 ? options.MaxUploadBytes : long.MaxValue;
            var buffer = new byte[81920];
            var written = 0L;
            var refused = false;

            try
            {
                await using var target = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, buffer.Length, useAsync: true);

                int read;
                while ((read = await content.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken)) > 0)
                {
                    written += read;

                    if (written > maxBytes)
                    {
                        // Stop before writing the chunk that broke the cap, so the cap is
                        // the real ceiling rather than one buffer's worth above it.
                        refused = true;
                        break;
                    }

                    await target.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                }
            }
            catch
            {
                // A failed or cancelled write must not leave a partial file behind: the
                // row that would have referenced it is never created either.
                TryDelete(fullPath);
                throw;
            }

            if (refused)
            {
                TryDelete(fullPath);
                throw new InvalidOperationException(
                    $"The file exceeds the {maxBytes / (1024 * 1024)} MB upload limit.");
            }

            return new StoredFileInfo(relativePath, written, FileContentTypes.FromFileName(extension));
        }

        public Stream? TryOpenRead(string relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath))
            {
                return null;
            }

            string fullPath;
            try
            {
                fullPath = ResolveWithinRoot(relativePath);
            }
            catch (Exception e) when (e is ArgumentException or NotSupportedException or PathTooLongException)
            {
                // A malformed or escaping path is data we refuse to act on, not a bug.
                return null;
            }

            return File.Exists(fullPath)
                ? new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true)
                : null;
        }

        public void Delete(string relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath))
            {
                return;
            }

            try
            {
                // ResolveWithinRoot already proved the path stays inside the root, so
                // this can only ever remove a file we own; the helper keeps the races
                // (already gone, locked by a reader) from turning cleanup into a failure.
                TryDelete(ResolveWithinRoot(relativePath));
            }
            catch (Exception e) when (e is ArgumentException or NotSupportedException or PathTooLongException)
            {
                // A malformed or escaping path is data we refuse to act on, not a bug.
            }
        }

        /// <summary>Best-effort removal used only on paths that already resolved inside the root.</summary>
        private static void TryDelete(string fullPath)
        {
            try
            {
                if (File.Exists(fullPath))
                {
                    File.Delete(fullPath);
                }
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException)
            {
            }
        }

        /// <summary>
        /// Maps a relative path onto the root and guarantees the result stays inside it.
        /// The comparison is against the root *with* its trailing separator so that a
        /// sibling directory sharing the root's name (…\storage-private) is refused too.
        /// </summary>
        private string ResolveWithinRoot(string relativePath)
        {
            var root = RootPath;
            var combined = Path.GetFullPath(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));

            var prefix = root.EndsWith(Path.DirectorySeparatorChar) ? root : root + Path.DirectorySeparatorChar;
            if (!combined.StartsWith(prefix, StorageComparison))
            {
                throw new ArgumentException($"The path '{relativePath}' resolves outside the storage root.", nameof(relativePath));
            }

            return combined;
        }

        /// <summary>
        /// Windows file systems compare paths case-insensitively, so the containment
        /// check has to as well — otherwise ..\..\STORAGE\..\secret would slip through.
        /// </summary>
        private static StringComparison StorageComparison =>
            OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

        /// <summary>
        /// Validates the extension and returns it normalised, so the file name the
        /// provider generates is always one the media-type map knows how to serve.
        /// </summary>
        private static string ExtensionFor(string fileName)
        {
            var name = Path.GetFileName(fileName ?? string.Empty).Trim();
            var extension = FileContentTypes.ExtensionOf(name);

            if (!FileContentTypes.IsSupported(extension))
            {
                throw new InvalidOperationException(
                    "Only PDF, PNG, JPG, WEBP and GIF files can be stored.");
            }

            return extension;
        }
    }
}
