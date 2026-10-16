namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Posts a comment on a request the caller may act on.</summary>
public sealed class CreateRequestCommentDto
{
    public string Comment { get; init; } = string.Empty;
}
