namespace Shared.DataTransferObject.Auth;

/// <summary>
/// In-session gym switch (ADR-002 Amendment 1): the gym must be in the caller's
/// UserGymAccess. The response token is scoped to the new gym.
/// </summary>
public sealed class SwitchGymRequest
{
    public int GymId { get; init; }
}
