namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>An employee document on file (mock §3 My Documents).</summary>
public sealed class EmployeeDocumentDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Category { get; init; } = string.Empty;
    public DateOnly UploadDate { get; init; }
    public DateOnly? ExpiryDate { get; init; }
    public string Status { get; init; } = string.Empty;
    public bool CanDownload { get; init; }
}
