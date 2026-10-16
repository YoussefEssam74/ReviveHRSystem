using DomainLayer.Models.EmployeeModule.Enums;

namespace DomainLayer.Models.EmployeeModule
{
    /// <summary>
    /// Stores uploaded documents belonging to an employee (e.g. Contract, National ID copy, Certifications).
    /// Tracks document expiry dates for alert triggers and whether the employee is allowed to self-upload/edit this document type.
    /// </summary>
    public class EmployeeDocument : BaseEntity<int>
    {
        public int EmployeeId { get; set; }
        public virtual Employee Employee { get; set; } = null!;

        public DocumentType Type { get; set; }
        public string FileName { get; set; } = string.Empty;

        /// <summary>
        /// Storage-relative path of the stored bytes (see IFileStorage). Empty means the
        /// row is metadata only — the document has no file behind it and cannot be
        /// downloaded, which is exactly what EmployeeDocumentDto.CanDownload reports.
        /// </summary>
        public string FilePath { get; set; } = string.Empty;

        /// <summary>Stored byte length, when a file is actually on disk.</summary>
        public long? SizeBytes { get; set; }

        /// <summary>Media type to serve the download as, when a file is stored.</summary>
        public string? ContentType { get; set; }

        /// <summary>Employee upload or HR-published official document.</summary>
        public DocumentSource Source { get; set; } = DocumentSource.Employee;

        public DateOnly? ExpiryDate { get; set; }
        public bool EmployeeEditable { get; set; } = false;

        /// <summary>When the document was uploaded (shown in the employee's vault).</summary>
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}

