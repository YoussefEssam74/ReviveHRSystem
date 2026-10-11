namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Create-request body (mock openNewRequest / submitNewRequest).</summary>
public sealed class CreateEmployeeRequestDto
{
    public string Type { get; init; } = string.Empty;
    public DateOnly RequestDate { get; init; }
    public DateOnly? EndDate { get; init; }
    public TimeOnly? RequestTime { get; init; }
    public TimeOnly? EndTime { get; init; }
    public int? SwapWithEmployeeId { get; init; }
    public decimal? OvertimeHours { get; init; }
    public string? DocumentCategory { get; init; }
    public string Reason { get; init; } = string.Empty;
}
