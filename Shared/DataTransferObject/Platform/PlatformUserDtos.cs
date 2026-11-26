namespace Shared.DataTransferObject.Platform;

// ------------------------------------------------------------------
// Platform users — §6.4
// Wraps the identity tables with the platform-wide shape (role, companies,
// counters). Distinct from the HR Team list, which is gym-scoped.
// ------------------------------------------------------------------

public class PlatformUserListQuery
{
    /// <summary>Case-insensitive substring of name, email or username.</summary>
    public string? Search { get; init; }

    /// <summary>Company id, or "platform" for users with no company (Top Management / HR Manager).</summary>
    public string? CompanyId { get; init; }

    /// <summary>SuperAdmin | HRManager | HR | BranchManager | TeamLeader | Employee.</summary>
    public string? Role { get; init; }

    /// <summary>Active | Invited | OnLeave | Suspended.</summary>
    public string? Status { get; init; }

    public int PageNumber { get; init; } = 1;
    public int PageSize { get; init; } = 25;
}

public class PlatformUserListItem
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public required string Email { get; init; }
    public required string Initials { get; init; }

    /// <summary>Avatar as a data URL or absolute URL; null falls back to the initials tile.</summary>
    public string? PhotoUrl { get; init; }

    /// <summary>TopManagement | HRManager | HR | Employee.</summary>
    public required string UserType { get; init; }

    /// <summary>Primary role name, or the user-type label when role-less.</summary>
    public required string Role { get; init; }

    public int? RoleId { get; init; }

    /// <summary>AllCompanies for platform roles, AssignedCompanies otherwise.</summary>
    public required string Scope { get; init; }

    public required IReadOnlyList<HrStaffCompanyRef> Companies { get; init; }
    public string? Branch { get; init; }
    public string? BranchCode { get; init; }
    public required string Status { get; init; }
    public DateTime? LastLoginAt { get; init; }
    public DateTime? CreatedOn { get; init; }
    public string? CreatedBy { get; init; }

    /// <summary>
    /// Preset role label the console shows as a badge ("Standard HR Manager"), or null
    /// when the account holds a custom role or no platform role at all.
    /// </summary>
    public string? Preset { get; init; }

    public int PermissionCount { get; init; }
}

public class PlatformUserCountsDto
{
    public int Total { get; init; }
    public int HrManagers { get; init; }
    public int Hr { get; init; }
    public int BranchManagers { get; init; }
    public int TeamLeaders { get; init; }
    public int Employees { get; init; }
    public int Active { get; init; }
    public int Suspended { get; init; }
}

public class PlatformUsersResponse
{
    public required IReadOnlyList<PlatformUserListItem> Items { get; init; }
    public required PlatformUserCountsDto Counts { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages { get; init; }
}

public class PlatformUserCompanyRef
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public string? City { get; init; }
}

public class PlatformUserBranchRef
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public required string Code { get; init; }
}

public class PlatformUserPermissionSummaryDto
{
    public int Total { get; init; }

    /// <summary>Permission count per catalogue area, for the profile's grouped list.</summary>
    public required IReadOnlyDictionary<string, int> Groups { get; init; }
}

public class PlatformUserAuditRef
{
    public int Id { get; init; }
    public required string Action { get; init; }
    public string? Target { get; init; }
    public string? Severity { get; init; }
    public DateTime OccurredAt { get; init; }
}

public class PlatformUserDetailResponse
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public required string Email { get; init; }
    public string? Phone { get; init; }
    public required string Initials { get; init; }

    /// <summary>Avatar as a data URL or absolute URL; null falls back to the initials tile.</summary>
    public string? PhotoUrl { get; init; }

    /// <summary>Personal details captured by the create-account wizard.</summary>
    public DateTime? DateOfBirth { get; init; }
    public string? Gender { get; init; }
    public string? NationalId { get; init; }
    public DateTime? HireDate { get; init; }
    public required string UserType { get; init; }
    public required string Role { get; init; }
    public int? RoleId { get; init; }

    /// <summary>System | Custom.</summary>
    public string? RoleType { get; init; }

    public string? RoleScope { get; init; }
    public required string Status { get; init; }
    public PlatformUserCompanyRef? Company { get; init; }
    public PlatformUserBranchRef? Branch { get; init; }
    public required IReadOnlyList<HrStaffCompanyRef> Companies { get; init; }
    public string? Preset { get; init; }
    public DateTime? JoinedOn { get; init; }
    public string? CreatedBy { get; init; }
    public DateTime? LastLoginAt { get; init; }
    public required PlatformUserPermissionSummaryDto Permissions { get; init; }
    public required IReadOnlyList<PlatformUserAuditRef> RecentAudit { get; init; }
}

/// <summary>Create HR Manager body — a platform account, no company assignment stored.</summary>
public class CreateHrManagerRequest
{
    public required string FullName { get; init; }
    public required string Email { get; init; }
    public string? Phone { get; init; }

    /// <summary>Preset role to bind (defaults to the HR Manager preset).</summary>
    public int? PresetRoleId { get; init; }

    /// <summary>
    /// Initial sign-in password chosen by the operator; omitted keeps the platform's
    /// temporary password. The account is always expected to change it later.
    /// </summary>
    public string? Password { get; init; }

    // Personal details — the same fields the HR console's create-account wizard collects.
    public DateTime? DateOfBirth { get; init; }
    public string? Gender { get; init; }
    public string? NationalId { get; init; }
    public DateTime? HireDate { get; init; }

    /// <summary>Downscaled avatar as a data URL.</summary>
    public string? PhotoUrl { get; init; }

    public bool SendInvite { get; init; } = true;
}

public class CreateHrManagerResponse
{
    public int Id { get; init; }
    public required string FullName { get; init; }
    public required string Email { get; init; }
    public required string UserType { get; init; }
    public required string Status { get; init; }
    public required string Scope { get; init; }
    public bool InviteSent { get; init; }
}

/// <summary>Create HR or Employee account. HR Manager cannot mint another HR Manager.</summary>
public class CreatePlatformUserRequest
{
    public required string FullName { get; init; }
    public required string Email { get; init; }
    public string? Phone { get; init; }

    /// <summary>HR | Employee. HRManager is refused — use the dedicated endpoint.</summary>
    public required string UserType { get; init; }

    /// <summary>Required for HR; the companies the user may operate in.</summary>
    public List<int>? CompanyIds { get; init; }

    public int? RoleId { get; init; }
    public List<string>? PermissionKeys { get; init; }
    public bool SendInvite { get; init; } = true;
}

public class ChangePlatformUserStatusRequest
{
    /// <summary>Active | Suspended.</summary>
    public required string Status { get; init; }
    public string? Reason { get; init; }
}

public class ChangePlatformUserStatusResponse
{
    public int Id { get; init; }
    public required string Status { get; init; }
    public int SessionsRevoked { get; init; }
    public DateTime ChangedAt { get; init; }
}

public class ResetPlatformUserPasswordRequest
{
    public bool RevokeSessions { get; init; } = true;
}

public class ResetPlatformUserPasswordResponse
{
    public int UserId { get; init; }
    public required string Email { get; init; }
    public bool ResetLinkSent { get; init; }
    public int SessionsRevoked { get; init; }
}

public class RevokeSessionsRequest
{
    public string? Reason { get; init; }
}

public class RevokeSessionsResponse
{
    public int UserId { get; init; }
    public int SessionsRevoked { get; init; }
}

/// <summary>Replaces a user's branch assignments wholesale; empty revokes all.</summary>
public class ReplaceGymAccessRequest
{
    public required List<int> BranchIds { get; init; }
}

public class ReplaceGymAccessResponse
{
    public int UserId { get; init; }
    public required IReadOnlyList<int> BranchIds { get; init; }
    public required IReadOnlyList<int> Added { get; init; }
    public required IReadOnlyList<int> Removed { get; init; }
}
