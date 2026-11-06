namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// A validated upload handed from the controller to the service: the original
    /// file name, the storage-relative path the controller has written the bytes to,
    /// the stored size/media type, and the category the caller selected.
    /// </summary>
    public class EmployeeDocumentUpload
    {
        public required string FileName { get; init; }
        public required string RelativeFilePath { get; init; }
        public required long SizeBytes { get; init; }
        public required string ContentType { get; init; }
        public required string Category { get; init; }
        public DateOnly? ExpiryDate { get; init; }
    }
}
