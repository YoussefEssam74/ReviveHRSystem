using System.Text.Json.Serialization;

namespace Shared.DataTransferObject.Auth;

/// <summary>Login result: a completed session or a gym-selection challenge.</summary>
public sealed class LoginResponse
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? AccessToken { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? ExpiresInSeconds { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public UserInfo? User { get; init; }

    public bool RequiresGymSelection { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public GymOption[]? Gyms { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? TempSessionToken { get; init; }
}
