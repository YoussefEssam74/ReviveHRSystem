using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Auth;

/// <summary>Completes login by selecting an authorized gym.</summary>
public sealed class SelectGymRequest
{
    [Range(1, int.MaxValue)]
    public int GymId { get; init; }

    [Required, StringLength(4096, MinimumLength = 1)]
    public string TempSessionToken { get; init; } = string.Empty;
}
