namespace Shared.DataTransferObject.Gym;

/// <summary>The active station code for a gym.</summary>
public sealed class StationCodeResponse
{
    public int GymId { get; init; }
    public string GymName { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public DateTime GeneratedAt { get; init; }

    /// <summary>When the code stops being accepted (UTC); null when it never expires (development seeds).</summary>
    public DateTime? ExpiresAtUtc { get; init; }

    public int? GeneratedBy { get; init; }
}

/// <summary>Result of revoking a gym's live station sessions.</summary>
public sealed class StationSessionsRevokedResponse
{
    /// <summary>Number of sessions that were live and are now revoked.</summary>
    public int RevokedCount { get; init; }
}
