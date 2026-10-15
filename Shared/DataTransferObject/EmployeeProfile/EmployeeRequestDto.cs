namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>One employee request (mock §10).</summary>
public sealed class EmployeeRequestDto
{
    public int Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public DateOnly SubmittedDate { get; init; }
    public DateOnly RequestDate { get; init; }
    public DateOnly? EndDate { get; init; }

    /// <summary>Second date of the request where the type uses one: the off day a weekly
    /// off swap takes in exchange for the given-up day.</summary>
    public DateOnly? TargetDate { get; init; }

    public TimeOnly? RequestTime { get; init; }

    /// <summary>Excused hours the request covers (late attendance / early leave).</summary>
    public decimal? Hours { get; init; }

    /// <summary>Amount asked for (salary advance).</summary>
    public decimal? Amount { get; init; }

    /// <summary>Colleague named by a shift swap / weekly off swap.</summary>
    public int? SwapWithEmployeeId { get; init; }
    public string? SwapWithEmployeeName { get; init; }

    /// <summary>A file (e.g. medical certificate) rides with this request.</summary>
    public bool HasAttachment { get; init; }

    public string Status { get; init; } = string.Empty;
    public string Reason { get; init; } = string.Empty;
    public IReadOnlyList<RequestTimelineStepDto> Timeline { get; init; } = Array.Empty<RequestTimelineStepDto>();
}
