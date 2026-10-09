namespace Shared.DataTransferObject.Gym;

/// <summary>The active station code for a gym.</summary>
public sealed class StationCodeResponse
{
    public int GymId { get; init; }
    public string GymName { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public DateTime GeneratedAt { get; init; }
    public int? GeneratedBy { get; init; }
}
