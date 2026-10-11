namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>A notification in the user's bell/inbox (mock §11).</summary>
public sealed class NotificationDto
{
    public int Id { get; init; }
    public string Category { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public DateTime Date { get; init; }
    public bool Read { get; init; }
    public string? Link { get; init; }
}
