namespace Shared.DataTransferObject.Platform;

// ------------------------------------------------------------------
// Branches — §6.3
// ------------------------------------------------------------------

public class BranchListItem
{
    public int Id { get; init; }
    public required string Code { get; init; }
    public required string Name { get; init; }
    public string? Area { get; init; }
    public string? Address { get; init; }
    public string? Phone { get; init; }
    public string? ManagerName { get; init; }
    public required string Status { get; init; }
    public int StaffCount { get; init; }
    public int EmployeeCount { get; init; }
    public int TeamLeaderCount { get; init; }
    public int BranchManagerCount { get; init; }
}

/// <summary>
/// Branch list plus the plan's cap. <see cref="BranchLimitReached"/> drives the
/// Add-branch guard without the client re-deriving it.
/// </summary>
public class BranchListResponse
{
    public required IReadOnlyList<BranchListItem> Items { get; init; }
    public int? BranchLimit { get; init; }
    public bool BranchLimitReached { get; init; }
}

/// <summary>Create/update body for a branch. The code is generated server-side.</summary>
public class BranchUpsertRequest
{
    public required string Name { get; init; }
    public string? Area { get; init; }
    public string? Address { get; init; }
    public string? Phone { get; init; }

    /// <summary>Employee who manages the branch; null leaves it unassigned.</summary>
    public int? ManagerEmployeeId { get; init; }
}

// ------------------------------------------------------------------
// HR staff assignment — §6.5
// ------------------------------------------------------------------

public class HrStaffCompanyRef
{
    public int Id { get; init; }
    public required string Name { get; init; }
}

public class HrStaffMember
{
    public int UserId { get; init; }
    public required string Name { get; init; }
    public required string Email { get; init; }
    public required string Initials { get; init; }
    public required IReadOnlyList<HrStaffCompanyRef> AssignedCompanies { get; init; }
    public int AssignedCompanyCount { get; init; }
    public string? PrimaryBranch { get; init; }
    public required string Status { get; init; }
    public DateTime? LastLoginAt { get; init; }
}

public class HrStaffListResponse
{
    public required IReadOnlyList<HrStaffMember> Items { get; init; }
}

/// <summary>Grants the named HR users access to a company (idempotent).</summary>
public class AssignHrStaffRequest
{
    public required List<int> UserIds { get; init; }

    /// <summary>Scope the grant to one branch; null grants the whole company.</summary>
    public int? BranchId { get; init; }
}

public class AssignHrStaffResponse
{
    public int CompanyId { get; init; }
    public required IReadOnlyList<int> Added { get; init; }
    public required IReadOnlyList<int> AlreadyAssigned { get; init; }
    public int AssignedTotal { get; init; }
}

public class RevokeHrStaffResponse
{
    public int CompanyId { get; init; }
    public int UserId { get; init; }
    public int RemainingCompanyCount { get; init; }
}
