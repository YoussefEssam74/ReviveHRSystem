namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Team follow-up item (mock 13.5 / 19 Team Actions).</summary>
public sealed class TeamFollowUpDto
{
    public int Id { get; init; }
    public int EmployeeId { get; init; }
    public string Employee { get; init; } = string.Empty;

    /// <summary>The team this item hangs off; null when a Branch Manager raised it
    /// about an employee who is not assigned to any team yet.</summary>
    public int? TeamId { get; init; }

    /// <summary>Action type: Reminder, Meeting, Escalation or Resolution.</summary>
    public string ActionType { get; init; } = string.Empty;

    /// <summary>What the follow-up is about (the mock's "type").</summary>
    public string Description { get; init; } = string.Empty;

    /// <summary>Severity: Low, Medium or High.</summary>
    public string Severity { get; init; } = string.Empty;

    /// <summary>Most recent action taken on the item.</summary>
    public string? LastAction { get; init; }

    /// <summary>Note carried by the latest action.</summary>
    public string? Note { get; init; }

    public bool IsResolved { get; init; }
}
