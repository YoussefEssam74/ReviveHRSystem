namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A required-document checklist entry (mock requiredDocs).</summary>
public sealed class RequiredDocumentDto
{
    public string Key { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public int? DocumentId { get; init; }
}
