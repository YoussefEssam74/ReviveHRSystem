namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Records an action on an existing follow-up (mock 13.7 Action modal).</summary>
public sealed class UpdateTeamFollowUpDto
{
    /// <summary>Reminder | Meeting | Escalation | Resolution.</summary>
    public string Action { get; init; } = string.Empty;

    /// <summary>Optional note recorded with the action.</summary>
    public string? Note { get; init; }
}
