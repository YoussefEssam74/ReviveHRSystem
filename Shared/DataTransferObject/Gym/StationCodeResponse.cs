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

/// <summary>A live kiosk session, as the Super Admin console lists it.</summary>
public sealed class StationSessionSummaryDto
{
    public int Id { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public DateTime ExpiresAtUtc { get; init; }

    /// <summary>Address the kiosk enrolled from — the quickest way to spot a rogue machine.</summary>
    public string? IpAddress { get; init; }

    /// <summary>Browser/OS string the device reported.</summary>
    public string? DeviceInfo { get; init; }

    /// <summary>Position the device shared at enrolment, if it did.</summary>
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
    public double? LocationAccuracyMeters { get; init; }
}

/// <summary>One gym's station state: who is connected and from where.</summary>
public sealed class StationGymSummaryDto
{
    public int GymId { get; init; }
    public required string GymName { get; init; }
    public int CompanyId { get; init; }
    public required string CompanyName { get; init; }
    public string? City { get; init; }

    /// <summary>When a station last enrolled successfully; null when none ever did.</summary>
    public DateTime? LastConnectedAt { get; init; }

    public required IReadOnlyList<StationSessionSummaryDto> Sessions { get; init; }
}

/// <summary>Platform-wide station overview (GET /api/platform/stations).</summary>
public sealed class StationOverviewResponse
{
    public required IReadOnlyList<StationGymSummaryDto> Items { get; init; }
}
