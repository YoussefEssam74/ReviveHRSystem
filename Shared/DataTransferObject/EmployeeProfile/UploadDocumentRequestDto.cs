namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Upload fields (mock openUploadModal): document type, display name, file.
/// Category is the DocumentType name: Contract, NationalId, Certification, Other.</summary>
public sealed class UploadDocumentRequestDto
{
    public string Category { get; init; } = string.Empty;
    public string FileName { get; init; } = string.Empty;
    public string? FilePath { get; init; }
    public DateOnly? ExpiryDate { get; init; }
}
