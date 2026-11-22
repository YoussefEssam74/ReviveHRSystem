namespace Shared.DataTransferObject.Platform;

// ------------------------------------------------------------------
// Impersonation ("Enter workspace") — §6.12
//
// An act-as session lets a Super Admin work inside a company with the
// capabilities of an assumed role. The issued token keeps userType =
// TopManagement (so nothing downstream can mistake the actor for its
// assumed role) and carries the act* claims that mark the session.
// ------------------------------------------------------------------

public class StartImpersonationRequest
{
    public int CompanyId { get; init; }

    /// <summary>Scope the session to one branch; null means the company as a whole.</summary>
    public int? BranchId { get; init; }

    /// <summary>Role the actor behaves as inside the workspace (HR Manager by default).</summary>
    public int? EffectiveRoleId { get; init; }

    /// <summary>Required (min 5 characters) — why the workspace was entered.</summary>
    public string? Reason { get; init; }
}

public class ImpersonationCompanyRef
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public string? City { get; init; }
}

public class ImpersonationBranchRef
{
    public int Id { get; init; }
    public required string Name { get; init; }
}

public class ImpersonationRoleRef
{
    public int Id { get; init; }
    public required string Name { get; init; }
}

public class ImpersonationActorRef
{
    public int UserId { get; init; }
    public required string Name { get; init; }
    public required string UserType { get; init; }
}

public class StartImpersonationResponse
{
    public int SessionId { get; init; }
    public required string AccessToken { get; init; }
    public int ExpiresInSeconds { get; init; }
    public required ImpersonationCompanyRef Company { get; init; }
    public ImpersonationBranchRef? Branch { get; init; }
    public ImpersonationRoleRef? EffectiveRole { get; init; }
    public required ImpersonationActorRef Actor { get; init; }
    public DateTime StartedAt { get; init; }
    public DateTime ExpiresAt { get; init; }
}

public class EndImpersonationRequest
{
    public int SessionId { get; init; }
}

public class EndImpersonationResponse
{
    public int SessionId { get; init; }
    public DateTime EndedAt { get; init; }
    public int DurationMinutes { get; init; }
}

/// <summary>
/// The session the caller's token is acting under. <see cref="Active"/> is false (and every
/// other field null) when the token is not an act-as token or the session already ended.
/// </summary>
public class CurrentImpersonationResponse
{
    public bool Active { get; init; }
    public int? SessionId { get; init; }
    public int? CompanyId { get; init; }
    public string? CompanyName { get; init; }
    public int? BranchId { get; init; }
    public string? BranchName { get; init; }
    public string? EffectiveRole { get; init; }
    public string? ActorName { get; init; }
    public DateTime? StartedAt { get; init; }
    public DateTime? ExpiresAt { get; init; }
}

/// <summary>Options for the "Act as" dropdown when entering a workspace.</summary>
public class LauncherRoleOption
{
    public int RoleId { get; init; }
    public required string Name { get; init; }

    /// <summary>System | Custom.</summary>
    public required string Type { get; init; }

    /// <summary>Platform | AllCompanies | AssignedCompanies | …</summary>
    public required string Scope { get; init; }
}

public class LauncherRoleOptionsResponse
{
    public required IReadOnlyList<LauncherRoleOption> Items { get; init; }
}
