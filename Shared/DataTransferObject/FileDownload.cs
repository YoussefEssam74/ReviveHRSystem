namespace Shared.DataTransferObject;

/// <summary>
/// A binary response to hand straight back to the client: the stream, the download
/// name the browser should save under, and the media type to serve it as. The
/// content type is always derived from the stored file, never from the request.
/// </summary>
public sealed record FileDownload(Stream Content, string FileName, string ContentType);
