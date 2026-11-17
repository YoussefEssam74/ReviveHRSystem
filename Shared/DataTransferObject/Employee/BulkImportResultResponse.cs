namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Result of a CSV bulk import (POST /api/employees/bulk-import): how many rows
    /// were onboarded and how many were skipped (existing email, unknown gym, or a
    /// malformed row).
    /// </summary>
    public class BulkImportResultResponse
    {
        public required string Message { get; init; }
        public int Added { get; init; }
        public int Skipped { get; init; }
    }
}
