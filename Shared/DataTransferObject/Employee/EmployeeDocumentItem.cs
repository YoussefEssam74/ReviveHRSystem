namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// One employee document (GET/POST /api/employees/{id}/documents): file name,
    /// category label, and validity — Valid, or Expiring Soon when the document
    /// expires within 30 days (or has already expired).
    /// </summary>
    public class EmployeeDocumentItem
    {
        public required string Name { get; init; }
        public required string Category { get; init; }
        public required string Status { get; init; }

        /// <summary>Id for the self-download route ({docId}/download).</summary>
        public int Id { get; init; }

        /// <summary>When the document was uploaded (the vault's date column).</summary>
        public DateOnly UploadDate { get; init; }

        public DateOnly? ExpiryDate { get; init; }
    }
}
