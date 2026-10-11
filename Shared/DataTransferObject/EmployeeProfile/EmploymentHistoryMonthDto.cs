namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>One month of employment-history events (mock §5).</summary>
public sealed class EmploymentHistoryMonthDto
{
    public string Month { get; init; } = string.Empty;
    public IReadOnlyList<EmploymentHistoryEventDto> Events { get; init; } = Array.Empty<EmploymentHistoryEventDto>();
}
