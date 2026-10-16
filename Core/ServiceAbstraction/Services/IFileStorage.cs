namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Where a stored file landed, so the row that references it can carry the size
    /// and media type that a download needs to serve it back correctly.
    /// </summary>
    public sealed record StoredFileInfo(string RelativePath, long SizeBytes, string ContentType);

    /// <summary>
    /// Binary storage boundary (mock §2.4 avatar, §3.5/§3.6 document downloads, and the
    /// payslip/attachment streams that ride on the same abstraction).
    ///
    /// Only the *relative* path is ever persisted or handed to a client: the physical
    /// root stays inside the provider, which is what keeps a stored path from turning
    /// into a traversal into the host filesystem. Implementations must therefore treat
    /// every incoming relative path as untrusted and refuse anything that escapes the
    /// root.
    /// </summary>
    public interface IFileStorage
    {
        /// <summary>
        /// Writes the stream under <paramref name="category"/> with a provider-generated
        /// unique name (the caller's file name is kept for display only, never used as
        /// the on-disk name), then returns the relative path to persist. The media type
        /// is derived from the file's extension rather than taken from the request, so
        /// the two can never disagree.
        /// </summary>
        /// <exception cref="InvalidOperationException">
        /// The file cannot be accepted because of the *request* — an unsupported
        /// extension or a body over the size cap. Callers surface this as a 400.
        /// </exception>
        /// <exception cref="ArgumentException">
        /// The <paramref name="category"/> is not one the provider knows. Categories are
        /// chosen by callers, never by the request, so this indicates a programming
        /// error and is deliberately not translated into a client-visible 400.
        /// </exception>
        Task<StoredFileInfo> SaveAsync(
            string category, string fileName, Stream content, CancellationToken cancellationToken = default);

        /// <summary>Opens a stored file for reading, or null when nothing is stored there.</summary>
        Stream? TryOpenRead(string relativePath);

        /// <summary>
        /// Removes a stored file. A path that is empty, malformed or resolves outside
        /// the root is ignored rather than raised: callers use this to clean up after
        /// themselves, so losing the file they already replaced is never worth failing
        /// the request that succeeded a moment ago.
        /// </summary>
        void Delete(string relativePath);
    }
}
