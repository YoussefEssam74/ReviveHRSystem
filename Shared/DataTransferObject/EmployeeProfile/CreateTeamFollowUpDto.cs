namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>
/// Raises a follow-up about one team member (mock 13.5). The action must be one of
/// Reminder, Meeting, Escalation or Resolution; choosing Resolution closes the item.
/// </summary>
public sealed class CreateTeamFollowUpDto
{
    /// <summary>In-scope employee the follow-up is about.</summary>
    public int EmployeeId { get; init; }

    /// <summary>Reminder | Meeting | Escalation | Resolution.</summary>
    public string Action { get; init; } = string.Empty;

    /// <summary>Low | Medium | High. Defaults to Medium when omitted.</summary>
    public string? Severity { get; init; }

    /// <summary>What the follow-up is about.</summary>
    public string Description { get; init; } = string.Empty;

    /// <summary>Optional free-form note recorded with the item.</summary>
    public string? Note { get; init; }
}
