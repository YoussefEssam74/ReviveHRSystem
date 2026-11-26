namespace DomainLayer.Models.PlatformModule
{
    /// <summary>
    /// A generated audit export package.
    ///
    /// The audit trail is append-only, so an export is a *snapshot* taken at request time.
    /// The rendered content is stored with the row rather than re-derived later: re-running
    /// the query would silently return a different answer (new events, newly reviewed rows),
    /// and an export handed to an auditor must stay byte-identical to what was delivered.
    ///
    /// Packages expire after the retention window and are purged by the cleanup job.
    /// </summary>
    public class AuditExportPackage : BaseEntity<int>
    {
        /// <summary>Public identifier, e.g. "EXP-2026-0042". Unique.</summary>
        public string ExportId { get; set; } = string.Empty;

        /// <summary>Csv | Json.</summary>
        public string Format { get; set; } = "Csv";

        /// <summary>Queued | Ready | Failed.</summary>
        public string Status { get; set; } = "Queued";

        /// <summary>Serialised filter the export was taken with, so the request can be audited.</summary>
        public string? FilterJson { get; set; }

        public int RowCount { get; set; }

        /// <summary>The rendered document, held so a re-download returns identical bytes.</summary>
        public string? Content { get; set; }

        public string? ContentType { get; set; }
        public string FileName { get; set; } = string.Empty;

        public int? RequestedByUserId { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
    }
}
