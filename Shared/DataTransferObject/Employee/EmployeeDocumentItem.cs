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
    }
}
