namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>One timeline chip of the employee's own request card.</summary>
public sealed class RequestTimelineStepDto
{
    public string Step { get; init; } = string.Empty;
    public string? Date { get; init; }

    /// <summary>The exact instant the step happened (UTC); prefer it over <see cref="Date"/>.</summary>
    public DateTime? OccurredAt { get; init; }

    public bool Done { get; init; }
}
