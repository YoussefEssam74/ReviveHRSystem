namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>An official company document published by HR (mock §3.3).</summary>
public sealed class HrDocumentDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;

    /// <summary>DocumentType name (Contract | NationalId | Certification | Other).</summary>
    public string Category { get; init; } = string.Empty;

    public DateOnly AddedDate { get; init; }

    /// <summary>Display size, e.g. "PDF · 2.1 MB", matching the mock's column.</summary>
    public string Size { get; init; } = string.Empty;

    /// <summary>Exact byte length, when a file is actually stored.</summary>
    public long? SizeBytes { get; init; }
}
