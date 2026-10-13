namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A comment on a request (mock 17.5 comment thread).</summary>
public sealed class RequestCommentDto
{
    public int Id { get; init; }
    public string Author { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public DateTime Date { get; init; }
}
