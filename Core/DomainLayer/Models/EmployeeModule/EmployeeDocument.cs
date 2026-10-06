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
        public string FilePath { get; set; } = string.Empty;
        public DateOnly? ExpiryDate { get; set; }
        public bool EmployeeEditable { get; set; } = false;
    }
}

